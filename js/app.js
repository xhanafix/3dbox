// Main application for 3D Box Shot Maker Pro
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the accordion functionality
    initAccordion();

    // Initialize the 3D scene
    const app = new BoxShotMaker();
    app.init();
});

// Accordion functionality
function initAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionItem = header.parentElement;
            accordionItem.classList.toggle('active');
        });
    });

    // Open the first accordion item by default
    if (accordionHeaders.length > 0) {
        accordionHeaders[0].parentElement.classList.add('active');
    }
    
    // Open the Box Settings accordion by default
    const boxSettingsHeader = document.querySelector('.accordion-item:nth-child(3) .accordion-header');
    if (boxSettingsHeader) {
        boxSettingsHeader.parentElement.classList.add('active');
    }
}

// Main BoxShotMaker class
class BoxShotMaker {
    constructor() {
        // DOM elements
        this.canvasContainer = document.getElementById('canvas-container');
        this.generateButton = document.getElementById('generate-image');
        this.downloadLink = document.getElementById('download-link');
        this.resultContainer = document.getElementById('result-container');
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.box = null;
        
        // Lights
        this.ambientLight = null;
        this.directionalLight = null;
        this.pointLight = null;
        
        // Textures and materials
        this.textures = {
            front: null,
            back: null,
            top: null,
            bottom: null,
            left: null,
            right: null
        };
        
        // Measurement units
        this.unitTypes = {
            mm: { name: "Millimeters", scale: 0.01, symbol: "mm" },  // 1mm = 0.01 Three.js units
            cm: { name: "Centimeters", scale: 0.1, symbol: "cm" },   // 1cm = 0.1 Three.js units
            in: { name: "Inches", scale: 0.254, symbol: "in" }       // 1inch = 0.254 Three.js units
        };
        
        this.currentUnit = "mm";
        
        // Box settings
        this.boxSettings = {
            width: 200,     // in mm
            height: 300,    // in mm
            depth: 50,      // in mm
            shininess: 30,
            shineColor: '#ffffff',
            boxType: 'standard',
            roundedCorners: false,
            cornerRadius: 10    // in mm
        };
        
        // Light settings
        this.lightSettings = {
            ambient: {
                color: '#ffffff',
                intensity: 0.5
            },
            directional: {
                color: '#ffffff',
                intensity: 0.5,
                lockPosition: false
            },
            point: {
                color: '#ffffff',
                intensity: 0.7,
                x: 2,
                y: 3,
                z: 2
            }
        };
        
        // Camera settings
        this.cameraSettings = {
            fov: 45,
            preset: 'front-right'
        };
        
        // Background settings
        this.backgroundSettings = {
            color: '#ffffff',
            transparent: false,
            image: null,
            imageAspectRatio: 1,
            useCustomBackground: false
        };
        
        // Render settings
        this.renderSettings = {
            width: 1200,
            height: 800,
            quality: 'high'
        };

        // Animation frame ID
        this.animationFrameId = null;
    }
    
    // Initialize the application
    init() {
        this.initScene();
        this.initLights();
        this.initBox();
        this.initEventListeners();
        this.updateUIValues();
        
        // Initialize image height field
        const aspectRatio = this.canvasContainer.clientWidth / this.canvasContainer.clientHeight;
        this.renderSettings.height = Math.round(this.renderSettings.width / aspectRatio);
        document.getElementById('image-height').value = this.renderSettings.height;
        
        this.animate();
    }
    
    // Convert dimensions from current unit to Three.js units
    convertToThreeUnits(value) {
        return value * this.unitTypes[this.currentUnit].scale;
    }
    
    // Convert dimensions from Three.js units to current unit
    convertFromThreeUnits(value) {
        return value / this.unitTypes[this.currentUnit].scale;
    }
    
    // Update the UI values to reflect the current box dimensions and unit
    updateUIValues() {
        document.getElementById('box-width-input').value = this.boxSettings.width;
        document.getElementById('box-height-input').value = this.boxSettings.height;
        document.getElementById('box-depth-input').value = this.boxSettings.depth;
        document.getElementById('corner-radius-input').value = this.boxSettings.cornerRadius;
        
        const unitLabels = document.querySelectorAll('.unit-label');
        unitLabels.forEach(label => {
            label.textContent = this.unitTypes[this.currentUnit].symbol;
        });
    }
    
    // Convert settings between units
    convertSettings(fromUnit, toUnit) {
        if (fromUnit === toUnit) return;
        
        const conversionFactor = this.unitTypes[fromUnit].scale / this.unitTypes[toUnit].scale;
        
        this.boxSettings.width = Math.round(this.boxSettings.width * conversionFactor);
        this.boxSettings.height = Math.round(this.boxSettings.height * conversionFactor);
        this.boxSettings.depth = Math.round(this.boxSettings.depth * conversionFactor);
        this.boxSettings.cornerRadius = Math.round(this.boxSettings.cornerRadius * conversionFactor);
        
        // Update input fields
        document.getElementById('box-width-input').value = this.boxSettings.width;
        document.getElementById('box-height-input').value = this.boxSettings.height;
        document.getElementById('box-depth-input').value = this.boxSettings.depth;
        document.getElementById('corner-radius-input').value = this.boxSettings.cornerRadius;
        
        this.updateUIValues();
    }
    
    // Initialize Three.js scene
    initScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.backgroundSettings.color);
        
        // Create camera
        const aspectRatio = this.canvasContainer.clientWidth / this.canvasContainer.clientHeight;
        this.camera = new THREE.PerspectiveCamera(this.cameraSettings.fov, aspectRatio, 0.1, 1000);
        this.setCameraPosition(this.cameraSettings.preset);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setSize(this.canvasContainer.clientWidth, this.canvasContainer.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.canvasContainer.appendChild(this.renderer.domElement);
        
        // Create orbit controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    // Initialize lights in the scene
    initLights() {
        // Ambient light
        this.ambientLight = new THREE.AmbientLight(
            this.lightSettings.ambient.color,
            this.lightSettings.ambient.intensity
        );
        this.scene.add(this.ambientLight);
        
        // Directional light
        this.directionalLight = new THREE.DirectionalLight(
            this.lightSettings.directional.color,
            this.lightSettings.directional.intensity
        );
        this.directionalLight.position.set(0, 5, 10);
        this.scene.add(this.directionalLight);
        
        // Point light
        this.pointLight = new THREE.PointLight(
            this.lightSettings.point.color,
            this.lightSettings.point.intensity
        );
        this.updatePointLightPosition();
        this.scene.add(this.pointLight);
    }
    
    // Update point light position based on camera
    updatePointLightPosition() {
        const cameraPosition = this.camera.position.clone();
        this.pointLight.position.set(
            cameraPosition.x + this.lightSettings.point.x,
            cameraPosition.y + this.lightSettings.point.y,
            cameraPosition.z + this.lightSettings.point.z
        );
    }
    
    // Initialize 3D box
    initBox() {
        // Create default placeholder materials
        const materials = this.createDefaultMaterials();
        
        // Create box geometry with dimensions converted to Three.js units
        const geometry = new THREE.BoxGeometry(
            this.convertToThreeUnits(this.boxSettings.width),
            this.convertToThreeUnits(this.boxSettings.height),
            this.convertToThreeUnits(this.boxSettings.depth)
        );
        
        // Create mesh with materials
        this.box = new THREE.Mesh(geometry, materials);
        this.scene.add(this.box);
    }
    
    // Create default materials for the box with placeholder textures
    createDefaultMaterials() {
        const placeHolderCanvas = this.createPlaceholderCanvas();
        const placeHolderTexture = new THREE.CanvasTexture(placeHolderCanvas);
        
        const frontMaterial = new THREE.MeshPhongMaterial({
            map: placeHolderTexture.clone(),
            shininess: this.boxSettings.shininess,
            specular: new THREE.Color(this.boxSettings.shineColor)
        });
        frontMaterial.name = 'front';
        
        const backMaterial = frontMaterial.clone();
        backMaterial.name = 'back';
        
        const topMaterial = frontMaterial.clone();
        topMaterial.name = 'top';
        
        const bottomMaterial = frontMaterial.clone();
        bottomMaterial.name = 'bottom';
        
        const leftMaterial = frontMaterial.clone();
        leftMaterial.name = 'left';
        
        const rightMaterial = frontMaterial.clone();
        rightMaterial.name = 'right';
        
        // Order matters: right, left, top, bottom, front, back
        return [
            rightMaterial,
            leftMaterial,
            topMaterial,
            bottomMaterial,
            frontMaterial,
            backMaterial
        ];
    }
    
    // Create a placeholder canvas with a grid pattern
    createPlaceholderCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Fill background
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth = 1;
        const gridSize = 32;
        
        for (let i = 0; i <= canvas.width; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        
        for (let i = 0; i <= canvas.height; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        // Draw "No Image" text
        ctx.fillStyle = '#808080';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Image', canvas.width / 2, canvas.height / 2);
        
        return canvas;
    }
    
    // Set camera position based on preset
    setCameraPosition(preset) {
        switch(preset) {
            case 'front-right':
                this.camera.position.set(4, 1, 4);
                break;
            case 'front-left':
                this.camera.position.set(-4, 1, 4);
                break;
            case 'back-right':
                this.camera.position.set(4, 1, -4);
                break;
            case 'back-left':
                this.camera.position.set(-4, 1, -4);
                break;
            case 'front':
                this.camera.position.set(0, 0, 5);
                break;
            case 'back':
                this.camera.position.set(0, 0, -5);
                break;
            case 'top':
                this.camera.position.set(0, 5, 0);
                break;
            default:
                this.camera.position.set(4, 1, 4);
        }
        
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.update();
        }
    }
    
    // Animation loop
    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());
        
        // Update controls
        this.controls.update();
        
        // Update light position if not locked
        if (!this.lightSettings.directional.lockPosition) {
            this.updatePointLightPosition();
        }
        
        // Render scene
        if (this.backgroundSettings.useCustomBackground && this.backgroundScene) {
            // First render the background
            this.renderer.autoClear = false;
            this.renderer.clear();
            this.renderer.render(this.backgroundScene, this.backgroundCamera);
            
            // Then render the main scene
            this.renderer.render(this.scene, this.camera);
            this.renderer.autoClear = true;
        } else {
            // Standard rendering
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // Handle window resize
    onWindowResize() {
        const width = this.canvasContainer.clientWidth;
        const height = this.canvasContainer.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        
        // Update background if needed
        if (this.backgroundSettings.useCustomBackground && this.backgroundSettings.image) {
            // Reload the background with current dimensions
            this.setupBackgroundImage(this.backgroundSettings.image.source?.data || this.backgroundSettings.image.image?.currentSrc);
        }
    }
    
    // Initialize event listeners for controls
    initEventListeners() {
        // Texture file inputs
        this.setupTextureUpload('front-texture', 'front-preview', 4); // Front
        this.setupTextureUpload('back-texture', 'back-preview', 5);   // Back
        this.setupTextureUpload('top-texture', 'top-preview', 2);     // Top
        this.setupTextureUpload('bottom-texture', 'bottom-preview', 3); // Bottom
        this.setupTextureUpload('left-texture', 'left-preview', 1);   // Left
        this.setupTextureUpload('right-texture', 'right-preview', 0); // Right
        
        // Background settings
        document.getElementById('bg-color').addEventListener('input', (e) => {
            this.backgroundSettings.color = e.target.value;
            if (!this.backgroundSettings.transparent && !this.backgroundSettings.useCustomBackground) {
                this.scene.background = new THREE.Color(this.backgroundSettings.color);
            }
        });
        
        document.getElementById('bg-transparent').addEventListener('change', (e) => {
            this.backgroundSettings.transparent = e.target.checked;
            if (e.target.checked) {
                // Make background transparent
                if (this.backgroundSettings.useCustomBackground) {
                    // Hide the custom background
                    this.backgroundSettings.useCustomBackground = false;
                }
                this.scene.background = null;
            } else {
                // Restore background based on settings
                if (this.backgroundSettings.image && document.getElementById('bg-image').files.length > 0) {
                    // Re-enable custom background if it was previously set
                    this.backgroundSettings.useCustomBackground = true;
                } else {
                    // Use solid color
                    this.scene.background = new THREE.Color(this.backgroundSettings.color);
                }
            }
        });
        
        document.getElementById('bg-image').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const bgPreview = document.getElementById('bg-preview');
                        bgPreview.style.backgroundImage = `url(${event.target.result})`;
                        
                        // Handle background image with proper proportions
                        this.setupBackgroundImage(event.target.result);
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
        
        // Measurement unit selection
        document.getElementById('unit-select').addEventListener('change', (e) => {
            const oldUnit = this.currentUnit;
            const newUnit = e.target.value;
            
            // Convert all the measurements to the new unit
            this.convertSettings(oldUnit, newUnit);
            
            // Update the current unit
            this.currentUnit = newUnit;
        });
        
        // Light settings
        // Ambient light
        document.getElementById('ambient-color').addEventListener('input', (e) => {
            this.lightSettings.ambient.color = e.target.value;
            this.ambientLight.color.set(e.target.value);
        });
        
        document.getElementById('ambient-intensity').addEventListener('input', (e) => {
            this.lightSettings.ambient.intensity = parseFloat(e.target.value);
            this.ambientLight.intensity = parseFloat(e.target.value);
        });
        
        // Directional light
        document.getElementById('directional-color').addEventListener('input', (e) => {
            this.lightSettings.directional.color = e.target.value;
            this.directionalLight.color.set(e.target.value);
        });
        
        document.getElementById('directional-intensity').addEventListener('input', (e) => {
            this.lightSettings.directional.intensity = parseFloat(e.target.value);
            this.directionalLight.intensity = parseFloat(e.target.value);
        });
        
        document.getElementById('lock-light-position').addEventListener('change', (e) => {
            this.lightSettings.directional.lockPosition = e.target.checked;
        });
        
        // Point light
        document.getElementById('point-color').addEventListener('input', (e) => {
            this.lightSettings.point.color = e.target.value;
            this.pointLight.color.set(e.target.value);
        });
        
        document.getElementById('point-intensity').addEventListener('input', (e) => {
            this.lightSettings.point.intensity = parseFloat(e.target.value);
            this.pointLight.intensity = parseFloat(e.target.value);
        });
        
        document.getElementById('point-x').addEventListener('input', (e) => {
            this.lightSettings.point.x = parseFloat(e.target.value);
            this.updatePointLightPosition();
        });
        
        document.getElementById('point-y').addEventListener('input', (e) => {
            this.lightSettings.point.y = parseFloat(e.target.value);
            this.updatePointLightPosition();
        });
        
        document.getElementById('point-z').addEventListener('input', (e) => {
            this.lightSettings.point.z = parseFloat(e.target.value);
            this.updatePointLightPosition();
        });
        
        // Box settings
        // Material
        document.getElementById('material-shininess').addEventListener('input', (e) => {
            this.boxSettings.shininess = parseInt(e.target.value);
            this.box.material.forEach(material => {
                material.shininess = parseInt(e.target.value);
            });
        });
        
        document.getElementById('shine-color').addEventListener('input', (e) => {
            this.boxSettings.shineColor = e.target.value;
            const color = new THREE.Color(e.target.value);
            this.box.material.forEach(material => {
                material.specular = color;
            });
        });
        
        // Size
        document.getElementById('box-width-input').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 500) {
                this.boxSettings.width = value;
                this.updateBoxGeometry();
            }
        });
        
        document.getElementById('box-height-input').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 500) {
                this.boxSettings.height = value;
                this.updateBoxGeometry();
            }
        });
        
        document.getElementById('box-depth-input').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 500) {
                this.boxSettings.depth = value;
                this.updateBoxGeometry();
            }
        });
        
        // Box type
        document.getElementById('box-type').addEventListener('change', (e) => {
            this.boxSettings.boxType = e.target.value;
            this.updateBoxPreset(e.target.value);
        });
        
        // Rounded corners
        document.getElementById('rounded-corners').addEventListener('change', (e) => {
            this.boxSettings.roundedCorners = e.target.checked;
            document.getElementById('corner-radius-input').disabled = !e.target.checked;
            this.updateBoxGeometry();
        });
        
        document.getElementById('corner-radius-input').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 50) {
                this.boxSettings.cornerRadius = value;
                if (this.boxSettings.roundedCorners) {
                    this.updateBoxGeometry();
                }
            }
        });
        
        // Camera settings
        document.getElementById('camera-preset').addEventListener('change', (e) => {
            this.cameraSettings.preset = e.target.value;
        });
        
        document.getElementById('apply-camera-preset').addEventListener('click', () => {
            this.setCameraPosition(this.cameraSettings.preset);
        });
        
        document.getElementById('camera-fov').addEventListener('input', (e) => {
            this.cameraSettings.fov = parseInt(e.target.value);
            this.camera.fov = parseInt(e.target.value);
            this.camera.updateProjectionMatrix();
        });
        
        // Save image
        document.getElementById('image-width').addEventListener('input', (e) => {
            this.renderSettings.width = parseInt(e.target.value);
            // Calculate height based on current renderer aspect ratio
            const aspectRatio = this.renderer.domElement.width / this.renderer.domElement.height;
            this.renderSettings.height = Math.round(this.renderSettings.width / aspectRatio);
            document.getElementById('image-height').value = this.renderSettings.height;
        });
        
        document.getElementById('image-quality').addEventListener('change', (e) => {
            this.renderSettings.quality = e.target.value;
        });
        
        // Generate image button
        this.generateButton.addEventListener('click', () => this.generateImage());
    }
    
    // Setup texture upload for each face
    setupTextureUpload(inputId, previewId, materialIndex) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        
        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        // Update preview
                        preview.style.backgroundImage = `url(${event.target.result})`;
                        
                        // Create texture from image
                        const texture = new THREE.TextureLoader().load(event.target.result);
                        
                        // Update material
                        this.box.material[materialIndex].map = texture;
                        this.box.material[materialIndex].needsUpdate = true;
                        
                        // Store texture
                        const face = inputId.split('-')[0];
                        this.textures[face] = texture;
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    
    // Update box geometry based on current settings
    updateBoxGeometry() {
        // Remove the old box
        this.scene.remove(this.box);
        
        // Create new geometry with dimensions converted to Three.js units
        let geometry;
        
        if (this.boxSettings.roundedCorners) {
            // Use rounded box geometry (simplified for this example)
            // In a real implementation, you might want to use a library like ThreeCSG
            // or implement a proper rounded box geometry
            geometry = new THREE.BoxGeometry(
                this.convertToThreeUnits(this.boxSettings.width),
                this.convertToThreeUnits(this.boxSettings.height),
                this.convertToThreeUnits(this.boxSettings.depth),
                4, 4, 4
            );
        } else {
            geometry = new THREE.BoxGeometry(
                this.convertToThreeUnits(this.boxSettings.width),
                this.convertToThreeUnits(this.boxSettings.height),
                this.convertToThreeUnits(this.boxSettings.depth)
            );
        }
        
        // Create new box with existing materials
        this.box = new THREE.Mesh(geometry, this.box.material);
        this.scene.add(this.box);
    }
    
    // Update box preset based on selected type
    updateBoxPreset(type) {
        switch(type) {
            case 'software':
                this.boxSettings.width = this.currentUnit === 'mm' ? 200 : (this.currentUnit === 'cm' ? 20 : 8);
                this.boxSettings.height = this.currentUnit === 'mm' ? 300 : (this.currentUnit === 'cm' ? 30 : 12);
                this.boxSettings.depth = this.currentUnit === 'mm' ? 50 : (this.currentUnit === 'cm' ? 5 : 2);
                break;
            case 'book':
                this.boxSettings.width = this.currentUnit === 'mm' ? 200 : (this.currentUnit === 'cm' ? 20 : 8);
                this.boxSettings.height = this.currentUnit === 'mm' ? 300 : (this.currentUnit === 'cm' ? 30 : 12);
                this.boxSettings.depth = this.currentUnit === 'mm' ? 20 : (this.currentUnit === 'cm' ? 2 : 0.8);
                break;
            case 'dvd':
                this.boxSettings.width = this.currentUnit === 'mm' ? 135 : (this.currentUnit === 'cm' ? 13.5 : 5.3);
                this.boxSettings.height = this.currentUnit === 'mm' ? 190 : (this.currentUnit === 'cm' ? 19 : 7.5);
                this.boxSettings.depth = this.currentUnit === 'mm' ? 15 : (this.currentUnit === 'cm' ? 1.5 : 0.6);
                break;
            case 'custom':
                // Keep current values
                break;
            default: // standard
                this.boxSettings.width = this.currentUnit === 'mm' ? 200 : (this.currentUnit === 'cm' ? 20 : 8);
                this.boxSettings.height = this.currentUnit === 'mm' ? 300 : (this.currentUnit === 'cm' ? 30 : 12);
                this.boxSettings.depth = this.currentUnit === 'mm' ? 50 : (this.currentUnit === 'cm' ? 5 : 2);
        }
        
        // Update input fields
        document.getElementById('box-width-input').value = this.boxSettings.width;
        document.getElementById('box-height-input').value = this.boxSettings.height;
        document.getElementById('box-depth-input').value = this.boxSettings.depth;
        
        // Update geometry
        this.updateBoxGeometry();
    }
    
    // Generate and save the image
    generateImage() {
        // Save current renderer size and camera aspect ratio
        const originalWidth = this.renderer.domElement.width;
        const originalHeight = this.renderer.domElement.height;
        const originalAspect = this.camera.aspect;
        
        // Set renderer to desired export size
        this.renderer.setSize(this.renderSettings.width, this.renderSettings.height);
        
        // Update camera aspect ratio to match the export dimensions
        this.camera.aspect = this.renderSettings.width / this.renderSettings.height;
        this.camera.updateProjectionMatrix();
        
        // Render the scene with appropriate background
        if (this.backgroundSettings.useCustomBackground && this.backgroundScene) {
            // First render the background
            this.renderer.autoClear = false;
            this.renderer.clear();
            this.renderer.render(this.backgroundScene, this.backgroundCamera);
            
            // Then render the main scene
            this.renderer.render(this.scene, this.camera);
            this.renderer.autoClear = true;
        } else {
            // Standard rendering
            this.renderer.render(this.scene, this.camera);
        }
        
        // Get the image data URL
        const imageDataURL = this.renderer.domElement.toDataURL('image/png');
        
        // Create image and add to result container
        const resultImage = document.createElement('img');
        resultImage.src = imageDataURL;
        const resultContainer = document.getElementById('result-image-container');
        resultContainer.innerHTML = '';
        resultContainer.appendChild(resultImage);
        
        // Set download link
        this.downloadLink.href = imageDataURL;
        this.downloadLink.download = `3d-box-${this.boxSettings.width}x${this.boxSettings.height}x${this.boxSettings.depth}${this.unitTypes[this.currentUnit].symbol}.png`;
        
        // Show result container
        this.resultContainer.classList.remove('hidden');
        
        // Restore original dimensions and camera
        this.renderer.setSize(originalWidth, originalHeight);
        this.camera.aspect = originalAspect;
        this.camera.updateProjectionMatrix();
        
        // Re-render with original settings
        if (this.backgroundSettings.useCustomBackground && this.backgroundScene) {
            this.renderer.autoClear = false;
            this.renderer.clear();
            this.renderer.render(this.backgroundScene, this.backgroundCamera);
            this.renderer.render(this.scene, this.camera);
            this.renderer.autoClear = true;
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // Handle background image with proper proportions
    setupBackgroundImage(imageUrl) {
        // Load the image to get its dimensions
        const img = new Image();
        img.onload = () => {
            // Create texture from image
            const texture = new THREE.TextureLoader().load(imageUrl);
            
            // Set proper texture parameters
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            
            // Get aspect ratios
            const imgAspect = img.width / img.height;
            const rendererAspect = this.renderer.domElement.width / this.renderer.domElement.height;
            
            // Create a background that preserves the image aspect ratio
            const backgroundPlane = new THREE.PlaneGeometry(2, 2, 1, 1);
            const backgroundMaterial = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
            });
            
            // Create background scene and camera for rendering the image properly
            this.backgroundScene = new THREE.Scene();
            this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            
            // Scale the image to fit while preserving aspect ratio
            let scale;
            if (imgAspect > rendererAspect) {
                // Image is wider than renderer, fit height
                scale = 1 / imgAspect * rendererAspect;
                backgroundPlane.scale(1 / scale, 1, 1);
            } else {
                // Image is taller than renderer, fit width
                scale = imgAspect / rendererAspect;
                backgroundPlane.scale(1, 1 / scale, 1);
            }
            
            const backgroundMesh = new THREE.Mesh(backgroundPlane, backgroundMaterial);
            this.backgroundScene.add(backgroundMesh);
            
            // Store image data for later use
            this.backgroundSettings.image = texture;
            this.backgroundSettings.imageAspectRatio = imgAspect;
            this.backgroundSettings.useCustomBackground = true;
            
            // No need to set scene.background as we'll render the background separately
            this.scene.background = null;
        };
        img.src = imageUrl;
    }
} 