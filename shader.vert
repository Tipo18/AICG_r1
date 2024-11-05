#version 300 es  // Specify GLSL version for WebGL 2.0

// Input attributes from the vertex buffer, passed in by the JavaScript code
in vec2 a_position;  // 2D position of the vertex
in vec2 a_uv;        // UV coordinates of the vertex for texture mapping or other uses

// Output variable that will be passed to the fragment shader
out vec2 f_uv;       // Pass UV coordinates to the fragment shader

void main() {
    // Set the position of the vertex in clip space
    // a_position is a 2D vector, so we extend it to a 4D vector (x, y, z, w)
    // z is set to 0 and w is set to 1 for 2D rendering
    gl_Position = vec4(a_position, 0, 1);

    // Pass the UV coordinates to the fragment shader
    f_uv = a_uv;
}
