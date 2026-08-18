

const HOLE_TEXEL = new Uint8Array([0, 0, 0, 0]);

const PIXEL_TILE_VERT = `
attribute vec2 a_pos;   // mercator coords (0..1)
attribute vec2 a_uv;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
    v_uv = a_uv;
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}
`;

const PIXEL_TILE_FRAG = `
precision highp float;

uniform sampler2D u_tex;
uniform vec2  u_texSize;         // texture size in texels
uniform float u_texelsPerPixel;  // how many texels one *device* pixel covers
uniform float u_softness;        // 0 = hard nearest, 1 = natural, >1 = softer
uniform float u_opacity;

varying vec2 v_uv;

void main() {
    // work in texel space
    vec2 uv = v_uv * u_texSize;

    // nearest texel border ("seam")
    vec2 seam = floor(uv + 0.5);

    // width of the blend band, in texels. one device pixel wide by default.
    vec2 w = max(vec2(u_texelsPerPixel * u_softness), vec2(1e-6));

    // snap everything to the texel centre except inside the band, where we let
    // the hardware's LINEAR filter interpolate -> 1px anti-aliased edges.
    vec2 snapped = seam + clamp((uv - seam) / w, vec2(-0.5), vec2(0.5));

    // textures are uploaded premultiplied, so a flat multiply is correct
    gl_FragColor = texture2D(u_tex, snapped / u_texSize) * u_opacity;
}
`;

class PixelTileLayer {
    constructor(id = 'pixel-tiles') {
        this.id = id;
        this.type = 'custom';
        this.renderingMode = '2d';

        this.map = null;
        this.gl = null;
        this.program = null;

        // tileKey -> { tex, w, h, west, east, north, south, verts }
        this.tiles = new Map();

        // tileKey -> Set<"x,y">
        this.holes = new Map();

        // tunables
        this.softness = 1.0;
        this.opacity = 1.0;
        this.maxSoftTexels = 4.0; // clamp so extreme zoom-out doesn't smear
    }

    // ---------- lifecycle ----------

    onAdd(map, gl) {
        this.map = map;
        this.gl = gl;
        this.isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined') &&
            (gl instanceof WebGL2RenderingContext);

        const compile = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                throw new Error('PixelTileLayer shader: ' + gl.getShaderInfoLog(s));
            }
            return s;
        };

        const vs = compile(gl.VERTEX_SHADER, PIXEL_TILE_VERT);
        const fs = compile(gl.FRAGMENT_SHADER, PIXEL_TILE_FRAG);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('PixelTileLayer link: ' + gl.getProgramInfoLog(this.program));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        this.aPos = gl.getAttribLocation(this.program, 'a_pos');
        this.aUv = gl.getAttribLocation(this.program, 'a_uv');
        this.uMatrix = gl.getUniformLocation(this.program, 'u_matrix');
        this.uTex = gl.getUniformLocation(this.program, 'u_tex');
        this.uTexSize = gl.getUniformLocation(this.program, 'u_texSize');
        this.uTexels = gl.getUniformLocation(this.program, 'u_texelsPerPixel');
        this.uSoftness = gl.getUniformLocation(this.program, 'u_softness');
        this.uOpacity = gl.getUniformLocation(this.program, 'u_opacity');

        // one shared dynamic buffer, rewritten per tile (4 verts * 4 floats)
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(16), gl.DYNAMIC_DRAW);
    }

    onRemove(map, gl) {
        for (const t of this.tiles.values()) gl.deleteTexture(t.tex);
        this.tiles.clear();
        if (this.buffer) gl.deleteBuffer(this.buffer);
        if (this.program) gl.deleteProgram(this.program);
        this.program = null;
        this.gl = null;
    }

    // ---------- tile management ----------

    /**
     * Upload / replace a tile.
     * @param {string} tileKey
     * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas} source
     * @param {Array<[number,number]>} lngLatCorners the 4 corners (any order)
     */
    setTile(tileKey, source, lngLatCorners) {
        const gl = this.gl;
        if (!gl) return; // layer not added yet

        let entry = this.tiles.get(tileKey);
        if (!entry) {
            entry = { tex: gl.createTexture(), w: 0, h: 0 };
            this.tiles.set(tileKey, entry);
        }

        gl.bindTexture(gl.TEXTURE_2D, entry.tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        // LINEAR is mandatory — the shader does the "nearest" part itself.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        entry.w = source.width;
        entry.h = source.height;

        // geometry
        let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
        for (const [lng, lat] of lngLatCorners) {
            west = Math.min(west, lng); east = Math.max(east, lng);
            south = Math.min(south, lat); north = Math.max(north, lat);
        }
        //entry.west = west; entry.east = east; entry.south = south; entry.north = north;

        //const M = maplibregl.MercatorCoordinate;
        //const tl = M.fromLngLat({ lng: west, lat: north });
        //const br = M.fromLngLat({ lng: east, lat: south });

        //// triangle strip: TL, BL, TR, BR
        //entry.verts = new Float32Array([
        //    tl.x, tl.y, 0, 1,
        //    tl.x, br.y, 0, 0,
        //    br.x, tl.y, 1, 1,
        //    br.x, br.y, 1, 0
        //]);


        entry.west = west; entry.east = east; entry.south = south; entry.north = north;

        const M = maplibregl.MercatorCoordinate;
        const a = M.fromLngLat({ lng: west, lat: north });
        const b = M.fromLngLat({ lng: east, lat: south });

        // local unit quad + double-precision placement, folded into the
        // matrix at draw time to dodge float32 precision loss at high zoom.
        entry.ox = a.x;
        entry.oy = a.y;
        entry.sx = b.x - a.x;
        entry.sy = b.y - a.y;

        // triangle strip: TL, BL, TR, BR   (v flipped)
        entry.verts = new Float32Array([
            0, 0, 0, 1,
            0, 1, 0, 0,
            1, 0, 1, 1,
            1, 1, 1, 0
        ]);

        entry.key = tileKey;
        this._applyHoles(entry);

        if (this.map) this.map.triggerRepaint();
    }

    hasTile(tileKey) { return this.tiles.has(tileKey); }

    removeTile(tileKey) {
        const entry = this.tiles.get(tileKey);
        if (!entry) return;
        if (this.gl) this.gl.deleteTexture(entry.tex);
        this.tiles.delete(tileKey);
        if (this.map) this.map.triggerRepaint();
    }

    clear() {
        for (const k of [...this.tiles.keys()]) this.removeTile(k);
    }

    // ---------- render ----------

    render(gl, args) {
        if (!this.program || this.tiles.size === 0) return;

        const raw = (args && args.defaultProjectionData)
            ? args.defaultProjectionData.mainMatrix
            : args;

        // widen to f64 once per frame
        const m = this._m64 || (this._m64 = new Float64Array(16));
        for (let i = 0; i < 16; i++) m[i] = raw[i];

        const out = this._out || (this._out = new Float64Array(16));
        const outF = this._outF || (this._outF = new Float32Array(16));

        const vpWidth = gl.drawingBufferWidth;

        gl.useProgram(this.program);
        gl.uniform1i(this.uTex, 0);
        gl.uniform1f(this.uOpacity, this.opacity);
        gl.uniform1f(this.uSoftness, this.softness);

        gl.activeTexture(gl.TEXTURE0);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.enableVertexAttribArray(this.aPos);
        gl.enableVertexAttribArray(this.aUv);
        gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 16, 8);

        // only the unit quad ever goes in the buffer now — upload once
        if (!this._quadUploaded) {
            const anyTile = this.tiles.values().next().value;
            if (anyTile && anyTile.verts) {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, anyTile.verts);
                this._quadUploaded = true;
            }
        }

        for (const entry of this.tiles.values()) {
            if (!entry.verts) continue;

            // out = m * translate(ox, oy) * scale(sx, sy), all in f64
            for (let r = 0; r < 4; r++) {
                const c0 = m[r], c1 = m[4 + r], c2 = m[8 + r], c3 = m[12 + r];
                out[r] = c0 * entry.sx;
                out[4 + r] = c1 * entry.sy;
                out[8 + r] = c2;
                out[12 + r] = c0 * entry.ox + c1 * entry.oy + c3;
            }
            for (let i = 0; i < 16; i++) outF[i] = out[i];

            // width of the tile's top edge, in device pixels, from *this* matrix
            const x0 = (out[12]) / (out[15]);
            const x1 = (out[0] + out[12]) / (out[3] + out[15]);
            const tileScreenPx = Math.abs(x1 - x0) * 0.5 * vpWidth;
            if (!(tileScreenPx > 0)) continue;

            const pxPerTexel = tileScreenPx / entry.w;
            const texelsPerPixel = Math.min(1 / pxPerTexel, this.maxSoftTexels);

            gl.uniformMatrix4fv(this.uMatrix, false, outF);
            gl.bindTexture(gl.TEXTURE_2D, entry.tex);
            gl.uniform2f(this.uTexSize, entry.w, entry.h);
            gl.uniform1f(this.uTexels, texelsPerPixel);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    }




    getHoles(tileKey) {
        let s = this.holes.get(tileKey);
        if (!s) { s = new Set(); this.holes.set(tileKey, s); }
        return s;
    }

    /**
     * Write a single texel. rgba must be PREMULTIPLIED — the
     * UNPACK_PREMULTIPLY_ALPHA_WEBGL flag does not apply to ArrayBufferView
     * uploads, only to DOM/ImageBitmap sources.
     */
    setTexel(tileKey, x, y, rgba) {
        const gl = this.gl;
        const e = this.tiles.get(tileKey);
        if (!gl || !e || !e.tex) return false;               // texture not resident
        if (x < 0 || y < 0 || x >= e.w || y >= e.h) return false;

        gl.bindTexture(gl.TEXTURE_2D, e.tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        if (this.map) this.map.triggerRepaint();
        return true;
    }

    /** Register a hole and punch it. Un-registering does NOT restore the
     *  pixel — the caller owns the source image, so restoring is its job. */
    addHole(tileKey, x, y) {
        this.getHoles(tileKey).add(x + ',' + y);
        this.setTexel(tileKey, x, y, HOLE_TEXEL);
    }

    removeHole(tileKey, x, y) {
        const s = this.holes.get(tileKey);
        if (s) {
            s.delete(x + ',' + y);
            if (s.size === 0) this.holes.delete(tileKey);
        }
    }

    clearHoles(tileKey) {
        if (tileKey === undefined) this.holes.clear();
        else this.holes.delete(tileKey);
    }

    _applyHoles(entry) {
        const s = this.holes.get(entry.key);
        if (!s || s.size === 0) return;

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, entry.tex);
        for (const k of s) {
            const i = k.indexOf(',');
            const x = +k.slice(0, i);
            const y = +k.slice(i + 1);
            if (x < 0 || y < 0 || x >= entry.w || y >= entry.h) continue;
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, HOLE_TEXEL);
        }
    }
}