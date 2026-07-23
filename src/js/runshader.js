window.setupShaderCanvas = function setupShaderCanvas(canvas, location) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");

    // --- create textures and FBOs ---
    let tex1, tex2, fb1, fb2;

    function resize() {
        const parent = canvas.parentElement;
        const width = parent.clientWidth;
        const height = parent.clientHeight;

        if (canvas.width === width && canvas.height === height) return;

        // keep old textures
        const oldTex1 = tex1;
        const oldTex2 = tex2;

        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);

        // create new textures & FBOs
        tex1 = createTexture(width, height);
        tex2 = createTexture(width, height);
        fb1 = createFBO(tex1);
        fb2 = createFBO(tex2);

        // copy oldTex1 into tex1
        if (oldTex1) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, createFBO(oldTex1));
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb1);
            gl.blitFramebuffer(
                0, 0, canvas.width, canvas.height,
                0, 0, canvas.width, canvas.height,
                gl.COLOR_BUFFER_BIT, gl.LINEAR
            );
        }

        // same for oldTex2 into tex2
        if (oldTex2) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, createFBO(oldTex2));
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb2);
            gl.blitFramebuffer(
                0, 0, canvas.width, canvas.height,
                0, 0, canvas.width, canvas.height,
                gl.COLOR_BUFFER_BIT, gl.LINEAR
            );
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }


    // --- load shaders & start render ---
    async function loadShader(url) {
        return fetch(url).then(r => r.text());
    }

    function compileShader(type, source) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, source);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(sh));
            throw new Error("Shader compilation error");
        }
        return sh;
    }

    function createTexture(w, h) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    function createFBO(texture) {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fbo;
    }

    function start(vsSource, fsSource) {
        const vShader = compileShader(gl.VERTEX_SHADER, vsSource);
        const fShader = compileShader(gl.FRAGMENT_SHADER, fsSource);

        const program = gl.createProgram();
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            return;
        }

        gl.useProgram(program);

        // Uniforms
        const uResolution = gl.getUniformLocation(program, "iResolution");
        const uTime = gl.getUniformLocation(program, "iTime");
        const uMouse = gl.getUniformLocation(program, "iMouse");
        const uBuffer0 = gl.getUniformLocation(program, "buffer0");

        // Set sampler to texture unit 0
        gl.uniform1i(uBuffer0, 0);

        // mouse
        let mouse = [0, 0, 0];
        window.addEventListener("mousemove", e => {
            const rect = canvas.getBoundingClientRect();
            mouse[0] = e.clientX - rect.left;
            mouse[1] = rect.height - (e.clientY - rect.top);
        });
        canvas.addEventListener("mousedown", () => mouse[2] = 1.0);
        window.addEventListener("mouseup", () => mouse[2] = 0.0);
        window.addEventListener("mouseleave", () => mouse[2] = 0.0);

        let animationFrameId = null;
        let lastTime = performance.now();
        let t = 0;

        function render() {
            const now = performance.now();
            const delta = Math.min(now - (lastTime ?? now), 50) / 1000;
            t += delta;
            lastTime = now;

            gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform2f(uResolution, canvas.width, canvas.height);
            gl.uniform1f(uTime, t);
            gl.uniform3f(uMouse, mouse[0], mouse[1], mouse[2]);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex2);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex1);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            [tex1, tex2] = [tex2, tex1];
            [fb1, fb2] = [fb2, fb1];

            animationFrameId = requestAnimationFrame(render);
        }

        function pause() {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
                lastTime = null;
            }
        }

        const observer = new MutationObserver(() => {
            if (canvas.offsetParent === null) pause();
            else if (!animationFrameId) animationFrameId = requestAnimationFrame(render);
        });
        observer.observe(canvas, { attributes: true, attributeFilter: ["style", "class"] });

        // start initially if visible
        if (canvas.offsetParent !== null) animationFrameId = requestAnimationFrame(render);
    }

    Promise.all([
        loadShader("shader/vertex.glsl"),
        loadShader(location)
    ]).then(([vs, fs]) => {
        start(vs, fs);
        window.addEventListener("resize", resize);
        resize();
    });
}
