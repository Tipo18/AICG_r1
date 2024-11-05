// Asynchronous function to load a shader's source code from an HTML element by ID
async function readShader(id) {
  const req = await fetch(document.getElementById(id).src); // Fetch the shader source from the element's src attribute
  return await req.text();  // Return the shader code as text
}

// Function to create and compile a WebGL shader
function createShader(gl, type, src) {
  let shader = gl.createShader(type);     // Create a new shader of the specified type (vertex or fragment)
  gl.shaderSource(shader, src);           // Attach the shader source code
  gl.compileShader(shader);               // Compile the shader

  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS); // Check for compilation success
  if (success) return shader;            // If compilation is successful, return the shader

  // Log an error and delete the shader if compilation fails
  console.error("Could not compile WebGL Shader", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

// Function to create a WebGL program and link shaders
function createProgram(gl, vertShader, fragShader) {
  let program = gl.createProgram();        // Create a new program
  gl.attachShader(program, vertShader);    // Attach the vertex shader
  gl.attachShader(program, fragShader);    // Attach the fragment shader
  gl.linkProgram(program);                 // Link the program

  let success = gl.getProgramParameter(program, gl.LINK_STATUS); // Check if linking was successful
  if (success) return program;            // Return the program if linking was successful

  // Log an error and delete the program if linking fails
  console.error("Could not Link WebGL Program", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

// Main asynchronous function to set up and start the rendering process
async function main() {


  let timetool = 0;
  const fps = document.getElementById("fps");  // Element to display FPS

  // Time tracking object to manage frame timing
  const time = {
    current_t: Date.now(),        // Current timestamp
    dts: [1 / 60],                // List to hold recent frame times (initialized with 1/60 for ~60 FPS)
    t: 0,                         // Total elapsed time

    // Function to get the most recent delta time
    dt: () => time.dts[0],

    // Update function to calculate frame time and update FPS display
    update: () => {
      const new_t = Date.now();                       // Get the current time
      time.dts = [(new_t - time.current_t) / 1_000,   // Calculate time since last frame in seconds
                  ...time.dts].slice(0, 10);          // Keep only the last 10 frame times
      time.t += time.dt();                            // Update total elapsed time
      time.current_t = new_t;                         // Set new current time

      // Calculate average delta time and update FPS display
      const dt = time.dts.reduce((a, dt) => a + dt, 0) / time.dts.length;
      fps.innerHTML = `${Math.round(1 / dt, 2)}`;     // Display FPS as 1 / average delta time

      timetool++;
      if(timetool%1 == 0){
        console.log(timetool);
        zrota += 2;
        if (zrota == 360){
          zrota = 0;
        }
        updateLoopBounds2();
      }
    },
  };

  // Canvas setup and WebGL 2 context initialization
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2");             // Get WebGL 2 context
  if (!gl) alert("Could not initialize WebGL Context."); // Alert if WebGL 2 is unavailable

  // Load and compile vertex and fragment shaders
  const vertShader = createShader(gl, gl.VERTEX_SHADER, await readShader("vert")); // Vertex shader
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, await readShader("frag")); // Fragment shader
  const program = createProgram(gl, vertShader, fragShader); // Link shaders into a program

  // Define attribute and uniform locations in the shader program
  const a_position = gl.getAttribLocation(program, "a_position"); // Vertex position attribute
  const a_uv = gl.getAttribLocation(program, "a_uv");             // UV coordinates attribute

  const u_resolution = gl.getUniformLocation(program, "u_resolution"); // Canvas resolution uniform
  const u_time = gl.getUniformLocation(program, "u_time");             // Elapsed time uniform
  const u_dt = gl.getUniformLocation(program, "u_dt");                 // Delta time uniform

  // Vertex data for a quad covering the entire canvas, with UV coordinates for texture mapping
  const data = new Float32Array([
    // x    y       u    v
    -1.0, -1.0,   0.0, 0.0,   // Bottom-left
     1.0, -1.0,   1.0, 0.0,   // Bottom-right
     1.0,  1.0,   1.0, 1.0,   // Top-right
    -1.0,  1.0,   0.0, 1.0,   // Top-left
  ]);

  // Index data to form two triangles for drawing the quad
  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  // Vertex Array Object (VAO) setup
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Vertex Buffer Object (VBO) setup for vertex data
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); // Upload vertex data

  // Define `a_position` attribute (vertex positions)
  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 4 * 4, 0); // 2 floats per position, stride 16 bytes

  // Define `a_uv` attribute (texture coordinates)
  gl.enableVertexAttribArray(a_uv);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 4 * 4, 2 * 4);  // 2 floats per UV, offset by 8 bytes

  // Element Buffer Object (EBO) setup for index data
  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW); // Upload index data

  // Unbind buffers and VAO to clean up
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


  // Define the initial sphere offset
  let sphereOffset = { x: 0.0, y: 0.0, z: 0.0 };  // Adjust as desired for the initial position

  // Get the uniform location for u_sphereOffset in the shader program
  const u_sphereOffset = gl.getUniformLocation(program, "u_sphereOffset");
  
  // Function to set the sphere offset in the shader
  function updateSphereOffset() {
    gl.useProgram(program);  // Use the WebGL program
    gl.uniform3f(u_sphereOffset, sphereOffset.x, sphereOffset.y, sphereOffset.z);  // Set initial value
  }
  
      // Initialize the uniform with the initial offset
  updateSphereOffset();

  // Event listeners to move sphere when buttons are clicked
  document.getElementById("leftBtn").addEventListener("click", () => {
    sphereOffset.x -= 0.5;  // Move sphere left
    updateSphereOffset();
  });

  document.getElementById("rightBtn").addEventListener("click", () => {
    sphereOffset.x += 0.5;  // Move sphere right
    updateSphereOffset();
  });

  document.getElementById("topBtn").addEventListener("click", () => {
    sphereOffset.y += 0.5;  // Move sphere up
    updateSphereOffset();
  });

  document.getElementById("bottomBtn").addEventListener("click", () => {
    sphereOffset.y -= 0.5;  // Move sphere down
    updateSphereOffset();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    sphereOffset = { x: 0.0, y: 0.0, z: 0.0 };  // Reset to initial position
    console.log("Reset button clicked");
    updateSphereOffset();
  });

  document.addEventListener("keydown", function(event) {
    switch (event.key) {
        case "ArrowLeft":
            event.preventDefault();    // Prevent default scrolling
            sphereOffset.x -= 0.5;
            updateSphereOffset();
            break;
        case "ArrowRight":
            event.preventDefault();
            sphereOffset.x += 0.5;
            updateSphereOffset();
            break;
        case "ArrowUp":
            event.preventDefault();
            sphereOffset.y += 0.5;
            updateSphereOffset();
            break;
        case "ArrowDown":
            event.preventDefault();
            sphereOffset.y -= 0.5;
            updateSphereOffset();
            break;
        case "r":
        case "R":
            event.preventDefault();
            sphereOffset = { x: 0.0, y: 0.0, z: 0.0 };  // Reset to initial position
            updateSphereOffset();
            console.log("Reset to initial position");  // Optional: Log the reset action
            break;
    }

    
  });  

    // Initialize loop bounds
  let x_len = 3;
  let y_len = 3;
  let z_len = 3;

  // Get uniform locations for loop bounds
  const u_x_len = gl.getUniformLocation(program, "u_x_len");
  const u_y_len = gl.getUniformLocation(program, "u_y_len");
  const u_z_len = gl.getUniformLocation(program, "u_z_len");

  // Function to update loop bounds uniforms
  function updateLoopBounds() {
      gl.useProgram(program);
      gl.uniform1i(u_x_len, x_len);
      gl.uniform1i(u_y_len, y_len);
      gl.uniform1i(u_z_len, z_len);
      updateDisplayedValues()
  }

  function updateDisplayedValues() {
    document.getElementById("xValue").innerText = `X: ${x_len}`;
    document.getElementById("yValue").innerText = `Y: ${y_len}`;
    document.getElementById("zValue").innerText = `Z: ${z_len}`;
}

  document.getElementById("incrementXBtn").addEventListener("click", () => {
    x_len++;  // Increment X dimension
    updateLoopBounds();
  });

  document.getElementById("resetXBtn").addEventListener("click", () => {
    x_len = 1;  // Reset X dimension to 1
    updateLoopBounds();
  });

  document.getElementById("incrementYBtn").addEventListener("click", () => {
      y_len++;  // Increment Y dimension
      updateLoopBounds();
  });

  document.getElementById("resetYBtn").addEventListener("click", () => {
      y_len = 1;  // Reset Y dimension to 1
      updateLoopBounds();
  });

  document.getElementById("incrementZBtn").addEventListener("click", () => {
      z_len++;  // Increment Z dimension
      updateLoopBounds();
  });

  document.getElementById("resetZBtn").addEventListener("click", () => {
      z_len = 1;  // Reset Z dimension to 1
      updateLoopBounds();
  });

  // Initialize the loop bounds uniforms
  updateLoopBounds();

      // Initialize loop bounds
      let cspace = 2;
      let xrota = 45;
      let yrota = 45;
      let zrota = 44; 
    
      // Get uniform locations for loop bounds
      const u_cspace = gl.getUniformLocation(program, "u_cspace");
      const u_xrota = gl.getUniformLocation(program, "u_xrota");
      const u_yrota = gl.getUniformLocation(program, "u_yrota");
      const u_zrota = gl.getUniformLocation(program, "u_zrota");
    
      // Function to update loop bounds uniforms
      function updateLoopBounds2() {
          gl.useProgram(program);
          gl.uniform1i(u_cspace, cspace);
          gl.uniform1i(u_xrota, xrota);
          gl.uniform1i(u_yrota, yrota);
          gl.uniform1i(u_zrota, zrota);
          updateDisplayedValues2()
      }
    
      function updateDisplayedValues2() {
        document.getElementById("cspace").innerText = `Space : ${cspace}`;
        document.getElementById("xrota").innerText = `X rota : ${xrota}`;
        document.getElementById("yrota").innerText = `Y rota : ${yrota}`;
        document.getElementById("zrota").innerText = `Z rota : ${zrota}`;
    }

    updateLoopBounds2()

  // Rendering loop to display the animated scene
  function loop() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // Set viewport to match canvas size
    gl.clearColor(0.0, 0.0, 0.0, 1.0);                    // Set clear color to black
    gl.clear(gl.COLOR_BUFFER_BIT);                        // Clear the canvas

    // Bind VAO and shader program
    gl.bindVertexArray(vao);
    gl.useProgram(program);

    // Update uniforms with resolution, elapsed time, and delta time
    gl.uniform2f(u_resolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(u_time, time.t);
    gl.uniform1f(u_dt, time.dt());

    // Draw the quad using the index buffer
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    // Unbind VAO for clean up
    gl.bindVertexArray(null);

    // Update time and schedule the next frame
    time.update();
    requestAnimationFrame(loop);  // Continue the rendering loop
  }

  // Start the rendering loop
  requestAnimationFrame(loop);
}

// Run the main function
main();

console.log("wk");

console.log("wk");

