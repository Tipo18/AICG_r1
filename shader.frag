#version 300 es
precision highp float;  // Set floating-point precision for this shader

// Constants for ray marching and scene settings
#define EPS         0.001       // Epsilon for ray-marching termination (close to the surface)
#define N_MAX_STEPS 80          // Maximum number of steps in the ray marching loop
#define MAX_DIST    100.0       // Maximum distance for ray marching

// Uniforms passed in from JavaScript, controlling resolution, time, and delta time
uniform vec2 u_resolution;      // Canvas resolution
uniform float u_time;           // Elapsed time, used for animation
uniform float u_dt;             // Delta time for frame timing

// Fragment input
in vec2 f_uv;                   // Fragment's UV coordinates from the vertex shader

// Fragment output
out vec4 outColor;              // Output color of the fragment

// Smooth minimum function for blending shapes (controls smooth blending between distances)
float smin(float a, float b, float k) {
    k *= log(2.0);
    float x = b - a;
    return a + x / (1.0 - exp2(x / k));
}

// Signed distance function (SDF) for a sphere
float sdp_sphere(vec3 p, float r) {
    return length(p) - r;
}

float sdTorus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// Add a uniform to control sphere position
uniform vec3 u_sphereOffset;

// Function to rotate a vector `p` around the x-axis by `angle` radians
vec3 rotateX(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(
        p.x,
        c * p.y - s * p.z,
        s * p.y + c * p.z
    );
}

// Function to rotate a vector `p` around the y-axis by `angle` radians
vec3 rotateY(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(
        c * p.x + s * p.z,
        p.y,
        -s * p.x + c * p.z
    );
}

// Function to rotate a vector `p` around the z-axis by `angle` radians
vec3 rotateZ(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(
        c * p.x - s * p.y,
        s * p.x + c * p.y,
        p.z
    );
}

uniform int u_x_len;
uniform int u_y_len;
uniform int u_z_len;

uniform int u_cspace;
uniform int u_xrota;
uniform int u_yrota;
uniform int u_zrota;

// Scene's SDF with a sphere
float sdf_scene(vec3 p) {
    float minDist = MAX_DIST;  // Initialize with max distance
    for (int x = 0; x < u_x_len; x++) {
        for (int y = 0; y < u_y_len; y++) {
            for (int z = 0; z < u_z_len; z++) {
                float scale = float(u_cspace) * sqrt(2.0);  // Pre-compute the scaling factor
                vec3 offset = vec3(float(x), float(y), float(z)) * scale + u_sphereOffset;

                // Translate `p` to the cube's local space and rotate
                vec3 localP = p - offset;
                localP = rotateX(localP, radians(float(u_xrota)));  // Rotate by 45 degrees around X
                localP = rotateY(localP, radians(float(u_yrota)));  // Rotate by 45 degrees around Y
                localP = rotateZ(localP, radians(float(u_zrota)));

                // Calculate the distance from the rotated local point
                float dist = sdBox(localP, vec3(1.0));
               minDist = min(minDist, dist); 
            }
        }
    }  
    return minDist;  // Return the minimum distance to any sphere
}

// Ray marching function to find the intersection point along a ray
float ray_march(vec3 ro, vec3 rd) {
    float t = 0.0;                      // Initialize ray distance
    for (int i = 0; i < N_MAX_STEPS; i++) {
        vec3 p = ro + rd * t;           // Calculate current point along the ray
        float d = sdf_scene(p);         // Calculate distance to the closest surface
        t += d;                         // Move the ray forward by `d`
        if (d < EPS || t > MAX_DIST) break; // Stop if close enough to a surface or exceeds max distance
    }
    return t;                           // Return the distance to the hit point or MAX_DIST if none
}

// Approximate normal at a point by sampling the SDF in different directions
vec3 approx_normal(vec3 p) {
    vec2 eps = vec2(EPS, -EPS);         // Epsilon values for finite difference calculation
    return normalize(
        eps.xyy * sdf_scene(p + eps.xyy) +  // Approximate x-normal
        eps.yyx * sdf_scene(p + eps.yyx) +  // Approximate y-normal
        eps.yxy * sdf_scene(p + eps.yxy) +  // Approximate z-normal
        eps.xxx * sdf_scene(p + eps.xxx)    // Approximate in reverse
    );
}

// Main function, executed for each fragment (pixel)
void main() {
    // Map UV coordinates to the -1 to 1 range, preserving aspect ratio
    vec2 uv = (f_uv * 2.0 - 1.0) * u_resolution / u_resolution.y;

    // Set up the camera position and direction
    vec3 ro = vec3(0.0, 0.0, -10.0);     // Ray origin (camera position)
    vec3 rd = normalize(vec3(uv, 1.0)); // Ray direction

    // Base ambient color
    vec3 a_col = vec3(1.0 / 255.0, 1.0 / 255.0, 18.0 / 255.0);
    vec3 col = a_col;                   // Initialize fragment color to ambient color

    // Light properties
    vec3 l_dir = normalize(vec3(sin(u_time), 0.0, cos(u_time))); // Light direction, animated over time
    //vec3 l_dir = normalize(vec3(1.0, 0.0, 0.0));
    vec3 l_col = vec3(1, 1, 1);   // Light color

    // Ray marching to find intersection distance along ray `rd`
    float t = ray_march(ro, rd);
    if (t <= MAX_DIST) {                // If an intersection is found within MAX_DIST
        vec3 p = ro + rd * t;           // Calculate intersection point `p`

        vec3 n = approx_normal(p);      // Calculate surface normal at point `p`
        vec3 diff = vec3(max(0.0, dot(l_dir, n))) * l_col; // Diffuse lighting

        float k = max(0.0, dot(n, -rd)); // View-dependent reflectivity coefficient
        vec3 ref = vec3(pow(k, 4.0)) * 1.0 * l_col; // Reflective highlight

        // Mix diffuse and reflective lighting with ambient color
        col = mix(diff + ref, a_col, 0.1);
    }

    // Apply gamma correction to the final color
    col = pow(col, vec3(0.4545));
    outColor = vec4(col, 1.0);          // Set the final color output of the fragment
}
