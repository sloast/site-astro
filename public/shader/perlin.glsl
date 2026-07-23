#version 300 es
precision mediump float;
out vec4 fragColor;

#define gridSize 200.
#define gradVecLen 1.5
#define speed .2

uniform vec3 iMouse;
uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D buffer0;

float rand2(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898f, 78.233f))) * 43758.5453f);
}
float rand3(vec3 co) {
    return fract(rand2(co.xy) + rand2(co.yz) * 235.21397f);
}
float randm(vec3 co, float mult) {
    return fract(rand3(co) * mult) * 2.f - 1.f;
}
vec3 grad(vec3 co) {
    return normalize(vec3(randm(co, 123.532f), randm(co, 3.123426f), randm(co, 5.23f))) * gradVecLen;
}
float calc(vec3 point, vec3 corner) {
    return dot(point - corner, grad(corner));
}

struct cont {
    float height;
    vec3 color;
};

cont[] colors = cont[](
    cont(-0.8f, vec3(.5f, 0, 1)),
    cont(-0.6f, vec3(0, .5f, 1)),
    cont(-0.4f, vec3(0, 1, 1)),
    cont(-0.2f, vec3(0, 1, .5f)),
    cont(0.0f, vec3(.2f, 1, 0)),
    cont(0.2f, vec3(1, 1, 0)),
    cont(0.4f, vec3(1, .5f, 0)),
    cont(0.6f, vec3(1, 0, 0)),
    cont(0.8f, vec3(1, 0, .5f))
);

int numcolors = 9;

float sm(float a, float b, float x) {
    x = smoothstep(0.f, 1.f, x);
    return mix(a, b, x);
}

float perlin(vec3 p) {
    p /= gridSize;
    vec3 p0 = floor(p);
    vec3 s = p - p0;

    #define f(v) dot(p-(v),grad(v))
    #define g(a,b) f(p0+vec3(0.,a,b)),f(p0+vec3(1.,a,b))
    return sm(sm(sm(g(0.f, 0.f), s.x), sm(g(1.f, 0.f), s.x), s.y), sm(sm(g(0.f, 1.f), s.x), sm(g(1.f, 1.f), s.x), s.y), s.z);
}

void mainImage(in vec2 fragCoord) {
    float scaling = 1.f; // 1000./iResolution.x;
    vec3 pos = vec3(fragCoord * scaling, iTime * speed * gridSize);

    // very low-freq noise as a base
    float value = perlin(pos * .25f);

    // add layered perlin noise
    for(int i = 0; i < 3; i++) {
        float mult = pow(2.0f, float(i));
        value += perlin(pos * mult) / mult;
    }

    // extra layers of noise near mouse
    vec2 muv = iMouse.xy / iResolution.x;
    vec2 uv = fragCoord / iResolution.x;
    float mdist = length(uv - muv);
    for(int i = 3; i < 7; i++) {
        float mult = pow(2.0f, float(i));
        value += perlin(pos * mult) / mult * max(0.f, 0.25f / float(i - 2) - mdist) * 10.f;
    }

    // compute the trail from the prev frame
    vec2 trailPos = vec2(fragCoord.x + 1.f, fragCoord.y + sin(iTime / 5.f) / 2.f);
    uv = trailPos / iResolution.xy;
    vec3 col = texture(buffer0, uv).xyz * 0.95f;

    // get contour lines
    int inx = int(round(value * 5.f + 4.f));
    float dist = abs(value - colors[inx].height);
    col = max(col, colors[inx].color * (1.f - pow(dist*30.f, 5.f)));

    // add cool mouse fade effect
    if(iMouse.z > 0.0f) {
        vec2 muv = iMouse.xy / iResolution.x;
        vec2 uv = fragCoord / iResolution.x;
        col = mix(vec3(value / 2.f + .5f), col, vec3(clamp(length(uv - muv) * 10.f - .5f, 0.f, 1.f)));
    }

    fragColor = vec4(col, 1.0f);
}

void main(void) {
    mainImage(gl_FragCoord.xy);
}
