#version 300 es
precision mediump float;

const vec2 verts[3] = vec2[](vec2(-1.0f, -1.0f), vec2(3.0f, -1.0f), vec2(-1.0f, 3.0f));

void main() {
    gl_Position = vec4(verts[gl_VertexID], 0.0f, 1.0f);
}
