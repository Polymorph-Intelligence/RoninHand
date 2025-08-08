class URDFBase extends THREE.Object3D {
    constructor(...args) {
        super(...args);
        this.urdfNode = null;
        this.urdfName = '';
    }

    copy(source, recursive) {
        super.copy(source, recursive);
        this.urdfNode = source.urdfNode;
        this.urdfName = source.urdfName;
        return this;
    }
}

class URDFCollider extends URDFBase {
    constructor(...args) {
        super(...args);
        this.isURDFCollider = true;
        this.type = 'URDFCollider';
    }
}

class URDFVisual extends URDFBase {
    constructor(...args) {
        super(...args);
        this.isURDFVisual = true;
        this.type = 'URDFVisual';
    }
}

class URDFLink extends URDFBase {
    constructor(...args) {
        super(...args);
        this.isURDFLink = true;
        this.type = 'URDFLink';
    }
}

class URDFJoint extends URDFBase {
    get jointType() {
        return this._jointType;
    }

    set jointType(v) {
        if (this.jointType === v) return;
        this._jointType = v;
        this.matrixWorldNeedsUpdate = true;
        switch (v) {
            case 'fixed':
                this.jointValue = [];
                break;
            case 'continuous':
            case 'revolute':
            case 'prismatic':
                this.jointValue = new Array(1).fill(0);
                break;
            case 'planar':
                this.jointValue = new Array(3).fill(0);
                this.axis = new THREE.Vector3(0, 0, 1);
                break;
            case 'floating':
                this.jointValue = new Array(6).fill(0);
                break;
        }
    }

    get angle() {
        return this.jointValue[0];
    }

    constructor(...args) {
        super(...args);
        this.isURDFJoint = true;
        this.type = 'URDFJoint';
        this.jointValue = null;
        this.jointType = 'fixed';
        this.axis = new THREE.Vector3(1, 0, 0);
        this.limit = { lower: 0, upper: 0 };
        this.ignoreLimits = false;
        this.origPosition = null;
        this.origQuaternion = null;
        this.mimicJoints = [];
    }

    copy(source, recursive) {
        super.copy(source, recursive);
        this.jointType = source.jointType;
        this.axis = source.axis.clone();
        this.limit.lower = source.limit.lower;
        this.limit.upper = source.limit.upper;
        this.ignoreLimits = false;
        this.jointValue = [...source.jointValue];
        this.origPosition = source.origPosition ? source.origPosition.clone() : null;
        this.origQuaternion = source.origQuaternion ? source.origQuaternion.clone() : null;
        this.mimicJoints = [...source.mimicJoints];
        return this;
    }

    setJointValue(...values) {
        if (!this.origPosition || !this.origQuaternion) {
            this.origPosition = this.position.clone();
            this.origQuaternion = this.quaternion.clone();
        }

        let didUpdate = false;
        this.mimicJoints.forEach(joint => {
            didUpdate = joint.updateFromMimickedJoint(...values) || didUpdate;
        });

        switch (this.jointType) {
            case 'fixed':
                return didUpdate;
            case 'continuous':
            case 'revolute': {
                let angle = values[0];
                if (angle == null) return didUpdate;
                if (angle === this.jointValue[0]) return didUpdate;

                if (!this.ignoreLimits && this.jointType === 'revolute') {
                    angle = Math.min(this.limit.upper, angle);
                    angle = Math.max(this.limit.lower, angle);
                }

                this.quaternion.copy(this.origQuaternion);
                this.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(this.axis, angle));

                if (this.jointValue[0] !== angle) {
                    this.jointValue[0] = angle;
                    this.matrixWorldNeedsUpdate = true;
                    return true;
                } else {
                    return didUpdate;
                }
            }
            case 'prismatic': {
                let pos = values[0];
                if (pos == null) return didUpdate;
                if (pos === this.jointValue[0]) return didUpdate;

                if (!this.ignoreLimits) {
                    pos = Math.min(this.limit.upper, pos);
                    pos = Math.max(this.limit.lower, pos);
                }

                this.position.copy(this.origPosition);
                this.position.addScaledVector(this.axis, pos);

                if (this.jointValue[0] !== pos) {
                    this.jointValue[0] = pos;
                    this.matrixWorldNeedsUpdate = true;
                    return true;
                } else {
                    return didUpdate;
                }
            }
        }
        return didUpdate;
    }
}

class URDFMimicJoint extends URDFJoint {
    constructor(...args) {
        super(...args);
        this.type = 'URDFMimicJoint';
        this.mimicJoint = null;
        this.offset = 0;
        this.multiplier = 1;
    }

    updateFromMimickedJoint(...values) {
        const modifiedValues = values.map(x => x * this.multiplier + this.offset);
        return super.setJointValue(...modifiedValues);
    }

    copy(source, recursive) {
        super.copy(source, recursive);
        this.mimicJoint = source.mimicJoint;
        this.offset = source.offset;
        this.multiplier = source.multiplier;
        return this;
    }
}

class URDFRobot extends URDFLink {
    constructor(...args) {
        super(...args);
        this.isURDFRobot = true;
        this.urdfNode = null;
        this.urdfRobotNode = null;
        this.robotName = null;
        this.links = null;
        this.joints = null;
        this.colliders = null;
        this.visual = null;
        this.frames = null;
    }

    copy(source, recursive) {
        super.copy(source, recursive);
        this.urdfRobotNode = source.urdfRobotNode;
        this.robotName = source.robotName;
        this.links = {};
        this.joints = {};
        this.colliders = {};
        this.visual = {};

        this.traverse(c => {
            if (c.isURDFJoint && c.urdfName in source.joints) {
                this.joints[c.urdfName] = c;
            }
            if (c.isURDFLink && c.urdfName in source.links) {
                this.links[c.urdfName] = c;
            }
            if (c.isURDFCollider && c.urdfName in source.colliders) {
                this.colliders[c.urdfName] = c;
            }
            if (c.isURDFVisual && c.urdfName in source.visual) {
                this.visual[c.urdfName] = c;
            }
        });

        this.frames = {
            ...this.colliders,
            ...this.visual,
            ...this.links,
            ...this.joints,
        };
        return this;
    }

    getFrame(name) {
        return this.frames[name];
    }

    setJointValue(jointName, ...angle) {
        const joint = this.joints[jointName];
        if (joint) {
            return joint.setJointValue(...angle);
        }
        return false;
    }

    setJointValues(values) {
        let didChange = false;
        for (const name in values) {
            const value = values[name];
            if (Array.isArray(value)) {
                didChange = this.setJointValue(name, ...value) || didChange;
            } else {
                didChange = this.setJointValue(name, value) || didChange;
            }
        }
        return didChange;
    }
}

class URDFLoader {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.robot = null;
        this.controls = null;
        this.animationId = null;
        this.joints = new Map();
        this.links = new Map();
        this.materials = new Map();
        this.stlLoader = new THREE.STLLoader();
        this.workingPath = '';
        this.packages = '';
        this.parseVisualElements = true;
        this.parseCollisionElements = false;
        
        // Add calibration data structure
        this.calibrationData = {};
        
        // Add animation state
        this.animationStartTime = 0;
        this.animationDuration = 0;
        this.animationTargetValues = {};
        this.animationStartValues = {};
        this.animationOnComplete = null;
        
        // Joint mapping for interactive dragging
        this.jointMapping = {
            'servo_1': 'pinky_pip',
            'servo_2': 'ring_pip',
            'servo_3': 'ring_mcp',
            'servo_4': 'middle_mcp',
            'servo_5': 'middle_pip',
            'servo_6': 'index_pip',
            'servo_7': 'pinky_mcp',
            'servo_8': 'index_mcp',
            'servo_9': 'thumb_mcp',
            'servo_10': 'thumb_pip',
            'servo_12': 'thumb_abduction'
        };
    }

    async init(containerId) {
        const container = document.getElementById(containerId);
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.clientWidth / container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0.1, 0.1, 0.1);

        // Create renderer with enhanced quality settings
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // Setup interactive joint dragging
        this.setupJointInteraction(container);

        // Add lights
        this.setupLights();

        // Add ground plane and environment
        this.setupEnvironment();

        // Add controls
        this.setupControls();

        // Load URDF with performance optimizations
        console.log('Loading URDF model...');
        const startTime = performance.now();
        await this.loadURDF('descriptions/RoninHand.urdf');
        const loadTime = performance.now() - startTime;
        console.log(`URDF loaded in ${loadTime.toFixed(2)}ms`);

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(containerId));
    }

    setupLights() {
        // Enhanced ambient light for better overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        // Main directional light with shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(2, 3, 2);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 15;
        directionalLight.shadow.camera.left = -3;
        directionalLight.shadow.camera.right = 3;
        directionalLight.shadow.camera.top = 3;
        directionalLight.shadow.camera.bottom = -3;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);

        // Fill light for softer shadows
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight.position.set(-1, 1, -1);
        this.scene.add(fillLight);

        // Rim light for edge definition
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(0, 0, 2);
        this.scene.add(rimLight);

        // Additional warm light for better material definition
        const warmLight = new THREE.DirectionalLight(0xfff4e6, 0.4);
        warmLight.position.set(1, 2, -1);
        this.scene.add(warmLight);

        // Subtle blue accent light for contrast
        const accentLight = new THREE.DirectionalLight(0x4a90e2, 0.2);
        accentLight.position.set(-2, 1, 1);
        this.scene.add(accentLight);
    }

    setupEnvironment() {
        // Create a more interesting ground with subtle grid pattern
        const groundGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a, // Slightly lighter than background
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.4
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0; // At origin level
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Create a more interesting environment map with gradient
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        
        // Create a gradient environment with subtle color variation
        const envScene = new THREE.Scene();
        const envGeometry = new THREE.SphereGeometry(1, 64, 64);
        
        // Create gradient material for environment
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 512;
        gradientCanvas.height = 256;
        const ctx = gradientCanvas.getContext('2d');
        
        // Create a subtle gradient from dark to slightly lighter
        const gradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);
        gradient.addColorStop(0, '#1a1a1a');   // Dark at top
        gradient.addColorStop(0.5, '#2a2a2a'); // Medium in middle
        gradient.addColorStop(1, '#1a1a1a');   // Dark at bottom
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);
        
        // Add subtle grid pattern
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.1;
        
        // Vertical lines
        for (let x = 0; x < gradientCanvas.width; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gradientCanvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < gradientCanvas.height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gradientCanvas.width, y);
            ctx.stroke();
        }
        
        const envTexture = new THREE.CanvasTexture(gradientCanvas);
        envTexture.mapping = THREE.EquirectangularReflectionMapping;
        
        this.scene.environment = pmremGenerator.fromEquirectangular(envTexture).texture;
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        pmremGenerator.dispose();
    }

    setupJointInteraction(container) {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedJoint = null;
        this.isDragging = false;
        this.dragPlane = new THREE.Plane();
        this.dragPoint = new THREE.Vector3();
        this.highlightedMeshes = [];

        // Mouse event listeners
        container.addEventListener('mousedown', (event) => this.onMouseDown(event));
        container.addEventListener('mousemove', (event) => this.onMouseMove(event));
        container.addEventListener('mouseup', (event) => this.onMouseUp(event));
        
        // Prevent context menu on right click
        container.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    onMouseDown(event) {
        if (!this.robot) return;

        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to find joints
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        for (const intersect of intersects) {
            // Find the joint that contains this mesh
            const joint = this.findJointFromMesh(intersect.object);
            if (joint && joint.jointType === 'revolute') {
                this.selectedJoint = joint;
                this.isDragging = true;
                
                // Set up drag plane perpendicular to camera
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    cameraDirection,
                    intersect.point
                );
                
                // Highlight the selected joint's meshes
                this.highlightJoint(joint);
                
                console.log(`Selected joint: ${joint.name}`);
                break;
            }
        }
    }

    onMouseMove(event) {
        if (!this.isDragging || !this.selectedJoint) return;

        // Calculate mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast against drag plane
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);

        // Calculate joint angle based on drag direction
        const jointAxis = this.selectedJoint.axis;
        const jointPosition = this.selectedJoint.getWorldPosition(new THREE.Vector3());
        
        // Create a vector from joint position to drag point
        const dragVector = new THREE.Vector3().subVectors(this.dragPoint, jointPosition);
        
        // Calculate angle based on drag distance and direction
        const dragDistance = dragVector.length();
        const maxDragDistance = 0.1; // Maximum drag distance for full range
        const normalizedDrag = Math.min(dragDistance / maxDragDistance, 1.0);
        
        // Map to joint angle range
        const jointRange = this.selectedJoint.limit.upper - this.selectedJoint.limit.lower;
        const angle = this.selectedJoint.limit.lower + normalizedDrag * jointRange;

        // Clamp angle to joint limits
        const clampedAngle = Math.max(
            this.selectedJoint.limit.lower,
            Math.min(this.selectedJoint.limit.upper, angle)
        );

        // Update joint value
        this.selectedJoint.setJointValue(clampedAngle);
        
        // Update corresponding servo position
        this.updateServoFromJoint(this.selectedJoint.name, clampedAngle);
        
        console.log(`Joint ${this.selectedJoint.name}: ${clampedAngle.toFixed(3)} rad (drag: ${normalizedDrag.toFixed(2)})`);
    }

    onMouseUp(event) {
        this.isDragging = false;
        this.selectedJoint = null;
        this.clearHighlight();
    }

    findJointFromMesh(mesh) {
        // Traverse up the object hierarchy to find the joint
        let current = mesh;
        while (current && current.parent) {
            if (current instanceof URDFJoint) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    updateServoFromJoint(jointName, angle) {
        // Find the servo that controls this joint
        const servoId = this.findServoForJoint(jointName);
        if (servoId) {
            // Convert joint angle to servo position
            const servoPosition = this.convertJointAngleToServoPosition(servoId, angle, jointName);
            
            // Update servo slider if it exists
            const slider = document.getElementById(servoId);
            if (slider) {
                slider.value = servoPosition;
                const valueSpan = document.getElementById(`${servoId}_value`);
                if (valueSpan) {
                    valueSpan.textContent = servoPosition;
                }
                
                // Trigger the slider's input event to update any listeners
                const inputEvent = new Event('input', { bubbles: true });
                slider.dispatchEvent(inputEvent);
            }
            
            // Update DIP joint if this is a PIP joint
            const dipJointName = this.getDipJointForPip(jointName);
            if (dipJointName) {
                const dipJoint = this.joints.get(dipJointName);
                if (dipJoint) {
                    dipJoint.setJointValue(angle);
                }
            }
            
            console.log(`Updated servo ${servoId} to position ${servoPosition} from joint ${jointName} angle ${angle.toFixed(3)}`);
        }
    }

    findServoForJoint(jointName) {
        // Reverse lookup from joint mapping
        for (const [servoId, mappedJoint] of Object.entries(this.jointMapping || {})) {
            if (mappedJoint === jointName) {
                return servoId;
            }
        }
        return null;
    }

    getDipJointForPip(pipJointName) {
        // DIP joint mapping
        const dipJointMapping = {
            'pinky_pip': 'pinky_dip',
            'ring_pip': 'ring_dip',
            'middle_pip': 'middle_dip',
            'index_pip': 'index_dip',
            'thumb_pip': 'thumb_dip'
        };
        return dipJointMapping[pipJointName] || null;
    }

    highlightJoint(joint) {
        this.clearHighlight();
        
        // Find all meshes belonging to this joint and its children
        const meshes = [];
        this.collectMeshes(joint, meshes);
        
        // Highlight each mesh
        for (const mesh of meshes) {
            if (mesh.material) {
                // Store original color
                mesh.userData.originalColor = mesh.material.color.clone();
                // Set highlight color
                mesh.material.color.setHex(0xffff00); // Yellow highlight
                mesh.material.emissive.setHex(0x333300); // Subtle glow
                this.highlightedMeshes.push(mesh);
            }
        }
    }

    clearHighlight() {
        // Restore original colors
        for (const mesh of this.highlightedMeshes) {
            if (mesh.material && mesh.userData.originalColor) {
                mesh.material.color.copy(mesh.userData.originalColor);
                mesh.material.emissive.setHex(0x000000);
            }
        }
        this.highlightedMeshes = [];
    }

    collectMeshes(object, meshes) {
        if (object.type === 'Mesh') {
            meshes.push(object);
        }
        
        for (const child of object.children) {
            this.collectMeshes(child, meshes);
        }
    }

    convertJointAngleToServoPosition(servoId, jointAngle, jointName) {
        // Use calibration data if available, otherwise use default conversion
        if (this.calibrationData && this.calibrationData[servoId]) {
            return this.convertServoPositionWithCalibration(servoId, jointAngle, jointName, this.jointMapping);
        } else {
            return this.convertJointAngleToServoPositionDefault(servoId, jointAngle);
        }
    }

    setupControls() {
        try {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 0.05;
            this.controls.maxDistance = 5;
            this.controls.maxPolarAngle = Math.PI;
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
        } catch (error) {
            console.warn('OrbitControls not available, using basic camera controls');
            this.controls = null;
        }
    }

    async loadURDF(urdfPath) {
        try {
            const response = await fetch(urdfPath);
            const urdfContent = await response.text();
            this.robot = await this.parseURDF(urdfContent, 'descriptions/');
            this.scene.add(this.robot);
            
            // Center and position the model properly
            this.centerAndPositionModel();
            
            console.log('URDF loaded successfully');
        } catch (error) {
            console.error('Error loading URDF:', error);
        }
    }

    centerAndPositionModel() {
        if (!this.robot) return;
        
        // Rotate the entire robot to face up (rotate around X-axis)
        this.robot.rotation.x = -Math.PI / 2;
        
        // Calculate bounding box after rotation
        const box = new THREE.Box3().setFromObject(this.robot);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5; // Increased distance to prevent clipping
        
        // Position the robot on the ground (y = 0)
        this.robot.position.y = -box.min.y;
        
        // Position camera to view the hand from above and slightly in front
        this.camera.position.copy(center);
        this.camera.position.x += distance * 0.2;
        this.camera.position.y += distance * 0.6;
        this.camera.position.z += distance * 0.4;
        this.camera.lookAt(center);
        
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.minDistance = maxDim * 0.5; // Adjust min distance based on model size
            this.controls.maxDistance = maxDim * 4; // Adjust max distance based on model size
            this.controls.update();
        }
    }

    async parseURDF(content, basePath) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const robotElement = xmlDoc.querySelector('robot');
        
        if (!robotElement) {
            throw new Error('No robot element found in URDF');
        }

        const robot = new URDFRobot();
        robot.name = robotElement.getAttribute('name') || 'robot';
        robot.robotName = robotElement.getAttribute('name') || 'robot';
        robot.urdfRobotNode = robotElement;

        // Parse materials
        this.materials = {};
        const materialElements = robotElement.querySelectorAll('material');
        for (const materialEl of materialElements) {
            const materialName = materialEl.getAttribute('name');
            this.materials[materialName] = this.parseMaterial(materialEl);
        }

        // Parse links and joints
        const links = new Map();
        const joints = new Map();
        const visualMap = {};
        const colliderMap = {};

        // First pass: create all links
        const linkElements = robotElement.querySelectorAll('link');
        for (const linkEl of linkElements) {
            const linkName = linkEl.getAttribute('name');
            const link = new URDFLink();
            link.name = linkName;
            link.urdfName = linkName;
            links.set(linkName, link);

            // Parse visual elements
            if (this.parseVisualElements) {
                const visualElements = linkEl.querySelectorAll('visual');
                for (const visualEl of visualElements) {
                    const visual = await this.parseVisual(visualEl, basePath);
                    if (visual) {
                        link.add(visual);
                        visualMap[linkName] = visual;
                    }
                }
            }

            // Parse collision elements
            if (this.parseCollisionElements) {
                const collisionElements = linkEl.querySelectorAll('collision');
                for (const collisionEl of collisionElements) {
                    const collision = await this.parseCollision(collisionEl, basePath);
                    if (collision) {
                        link.add(collision);
                        colliderMap[linkName] = collision;
                    }
                }
            }
        }

        // Second pass: create joints and connect links
        const jointElements = robotElement.querySelectorAll('joint');
        for (const jointEl of jointElements) {
            const jointName = jointEl.getAttribute('name');
            const jointType = jointEl.getAttribute('type');
            const parentLink = jointEl.querySelector('parent');
            const childLink = jointEl.querySelector('child');

            if (parentLink && childLink) {
                const parentLinkName = parentLink.getAttribute('link');
                const childLinkName = childLink.getAttribute('link');
                
                const parent = links.get(parentLinkName);
                const child = links.get(childLinkName);
                
                if (parent && child) {
                    const joint = await this.parseJoint(jointEl, child, basePath);
                    if (joint) {
                        parent.add(joint);
                        joints.set(jointName, joint);
                    }
                }
            }
        }

        // Link up mimic joints
        const jointList = Array.from(joints.values());
        jointList.forEach(j => {
            if (j instanceof URDFMimicJoint) {
                const mimickedJoint = joints.get(j.mimicJoint);
                if (mimickedJoint) {
                    mimickedJoint.mimicJoints.push(j);
                }
            }
        });

        // Detect infinite loops of mimic joints
        jointList.forEach(j => {
            const uniqueJoints = new Set();
            const iterFunction = joint => {
                if (uniqueJoints.has(joint)) {
                    throw new Error('URDFLoader: Detected an infinite loop of mimic joints.');
                }
                uniqueJoints.add(joint);
                joint.mimicJoints.forEach(mimicJoint => {
                    iterFunction(mimicJoint);
                });
            };
            iterFunction(j);
        });

        // Find root link (link without parent joint)
        const usedLinks = new Set();
        for (const joint of joints.values()) {
            usedLinks.add(joint.name);
        }

        for (const [linkName, link] of links) {
            if (!usedLinks.has(linkName)) {
                robot.add(link);
                break;
            }
        }

        // Set up robot properties
        robot.joints = joints;
        robot.links = links;
        robot.colliders = colliderMap;
        robot.visual = visualMap;
        robot.frames = {
            ...colliderMap,
            ...visualMap,
            ...links,
            ...joints,
        };

        this.joints = joints;
        this.links = links;
        return robot;
    }

    parseMaterial(materialEl) {
        const material = new THREE.MeshStandardMaterial();
        
        const colorEl = materialEl.querySelector('color');
        if (colorEl) {
            const rgba = colorEl.getAttribute('rgba')?.split(' ').map(Number) || [1, 1, 1, 1];
            material.color.setRGB(rgba[0], rgba[1], rgba[2]);
            material.opacity = rgba[3];
            material.transparent = rgba[3] < 1;
            material.depthWrite = !material.transparent;
        }

        // Enhanced material properties for realistic plastic/metal parts
        material.roughness = 0.6; // Slightly less rough for better definition
        material.metalness = 0.1; // Slight metallic component for realism
        material.envMapIntensity = 0.4; // Better environment reflections
        material.normalScale = new THREE.Vector2(1.0, 1.0); // Normal mapping for surface detail

        const textureEl = materialEl.querySelector('texture');
        if (textureEl) {
            const filename = textureEl.getAttribute('filename');
            if (filename) {
                const textureLoader = new THREE.TextureLoader();
                material.map = textureLoader.load(filename);
                material.map.encoding = THREE.sRGBEncoding;
            }
        }

        return material;
    }

    async parseVisual(visualEl, basePath) {
        const geometryEl = visualEl.querySelector('geometry');
        if (!geometryEl) return null;

        const materialEl = visualEl.querySelector('material');
        // Create more realistic materials with different colors for different parts
        let material = this.createRealisticMaterial(visualEl);
        
        if (materialEl) {
            const materialName = materialEl.getAttribute('name');
            if (this.materials[materialName]) {
                material = this.materials[materialName];
            }
        }

        const visual = new URDFVisual();
        visual.urdfNode = visualEl;

        // Parse origin
        const originEl = visualEl.querySelector('origin');
        if (originEl) {
            const xyz = this.parseXYZ(originEl.getAttribute('xyz') || '0 0 0');
            const rpy = this.parseXYZ(originEl.getAttribute('rpy') || '0 0 0');
            visual.position.set(xyz[0], xyz[1], xyz[2]);
            visual.rotation.set(rpy[0], rpy[1], rpy[2], 'ZYX');
        }

        // Parse geometry
        const mesh = await this.parseGeometry(geometryEl, basePath, material);
        if (mesh) {
            // Set shadow properties on the mesh, not the material
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            visual.add(mesh);
        }

        return visual;
    }

    async parseCollision(collisionEl, basePath) {
        const geometryEl = collisionEl.querySelector('geometry');
        if (!geometryEl) return null;

        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.3,
            wireframe: true 
        });

        const collision = new URDFCollider();
        collision.urdfNode = collisionEl;

        // Parse origin
        const originEl = collisionEl.querySelector('origin');
        if (originEl) {
            const xyz = this.parseXYZ(originEl.getAttribute('xyz') || '0 0 0');
            const rpy = this.parseXYZ(originEl.getAttribute('rpy') || '0 0 0');
            collision.position.set(xyz[0], xyz[1], xyz[2]);
            collision.rotation.set(rpy[0], rpy[1], rpy[2], 'ZYX');
        }

        // Parse geometry
        const mesh = await this.parseGeometry(geometryEl, basePath, material);
        if (mesh) {
            collision.add(mesh);
        }

        return collision;
    }

    async parseGeometry(geometryEl, basePath, material) {
        const children = geometryEl.children;
        if (children.length === 0) return null;

        const geoType = children[0].nodeName.toLowerCase();
        
        switch (geoType) {
            case 'mesh':
                return await this.parseMesh(children[0], basePath, material);
            case 'box':
                return this.parseBox(children[0], material);
            case 'sphere':
                return this.parseSphere(children[0], material);
            case 'cylinder':
                return this.parseCylinder(children[0], material);
            default:
                console.warn(`Unknown geometry type: ${geoType}`);
                return null;
        }
    }

    async parseMesh(meshEl, basePath, material) {
        const filename = meshEl.getAttribute('filename');
        if (!filename) return null;

        const scaleAttr = meshEl.getAttribute('scale');
        let scale = [1, 1, 1];
        if (scaleAttr) {
            scale = this.parseXYZ(scaleAttr);
        }

        try {
            const geometry = await this.loadSTL(basePath + filename);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(scale[0], scale[1], scale[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        } catch (error) {
            console.error('Error loading mesh:', filename, error);
            return null;
        }
    }

    parseBox(boxEl, material) {
        const size = this.parseXYZ(boxEl.getAttribute('size') || '1 1 1');
        const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    parseSphere(sphereEl, material) {
        const radius = parseFloat(sphereEl.getAttribute('radius')) || 0.5;
        const geometry = new THREE.SphereGeometry(radius, 30, 30);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    parseCylinder(cylinderEl, material) {
        const radius = parseFloat(cylinderEl.getAttribute('radius')) || 0.5;
        const length = parseFloat(cylinderEl.getAttribute('length')) || 1.0;
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 30);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2; // URDF cylinders are along Z-axis
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    async parseJoint(jointEl, childLink, basePath) {
        const jointType = jointEl.getAttribute('type');
        const jointName = jointEl.getAttribute('name');
        
        const originEl = jointEl.querySelector('origin');
        const axisEl = jointEl.querySelector('axis');
        const limitEl = jointEl.querySelector('limit');
        const mimicEl = jointEl.querySelector('mimic');

        let joint;
        if (mimicEl) {
            joint = new URDFMimicJoint();
            joint.mimicJoint = mimicEl.getAttribute('joint');
            joint.offset = parseFloat(mimicEl.getAttribute('offset')) || 0;
            joint.multiplier = parseFloat(mimicEl.getAttribute('multiplier')) || 1;
        } else {
            joint = new URDFJoint();
        }

        joint.name = jointName;
        joint.urdfName = jointName;
        joint.urdfNode = jointEl;
        joint.jointType = jointType;
        joint.axis = new THREE.Vector3(1, 0, 0);
        joint.limit = { lower: -Math.PI, upper: Math.PI };
        joint.ignoreLimits = false;
        joint.origPosition = null;
        joint.origQuaternion = null;

        // Parse origin
        if (originEl) {
            const xyz = this.parseXYZ(originEl.getAttribute('xyz') || '0 0 0');
            const rpy = this.parseXYZ(originEl.getAttribute('rpy') || '0 0 0');
            joint.position.set(xyz[0], xyz[1], xyz[2]);
            joint.rotation.set(rpy[0], rpy[1], rpy[2], 'ZYX');
        }

        // Parse axis
        if (axisEl) {
            const axis = this.parseXYZ(axisEl.getAttribute('xyz') || '1 0 0');
            joint.axis.set(axis[0], axis[1], axis[2]);
        }

        // Parse limits
        if (limitEl) {
            joint.limit.lower = parseFloat(limitEl.getAttribute('lower')) || -Math.PI;
            joint.limit.upper = parseFloat(limitEl.getAttribute('upper')) || Math.PI;
        }

        // Store original transform
        joint.origPosition = joint.position.clone();
        joint.origQuaternion = joint.quaternion.clone();

        joint.add(childLink);
        return joint;
    }

    parseXYZ(xyzString) {
        if (!xyzString) return [0, 0, 0];
        return xyzString.trim().split(/\s+/g).map(num => parseFloat(num));
    }

    createRealisticMaterial(visualEl) {
        // Get the parent link name to determine material type
        let linkName = '';
        let current = visualEl.parentElement;
        while (current && current.tagName !== 'link') {
            current = current.parentElement;
        }
        if (current) {
            linkName = current.getAttribute('name') || '';
        }

        console.log('Creating material for link:', linkName);

        // Create materials with original colors but improved properties
        let material;
        
        if (linkName.includes('palm') || linkName.includes('base')) {
            // Palm/base material - black with good properties
            material = new THREE.MeshStandardMaterial({
                color: 0x000000, // Black
                roughness: 0.7,
                metalness: 0.3,
                envMapIntensity: 0.5
            });
            console.log('Applied palm material (black)');
        } else {
            // All fingers get the same original color but with better material properties
            material = new THREE.MeshStandardMaterial({
                color: 0xcccccc, // Original light gray color
                roughness: 0.5,
                metalness: 0.2,
                envMapIntensity: 0.6
            });
            console.log('Applied finger material (original gray)');
        }

        return material;
    }

    async loadSTL(path) {
        return new Promise((resolve, reject) => {
            this.stlLoader.load(
                path,
                geometry => {
                    // Optimize geometry for better performance
                    geometry.computeBoundingSphere();
                    geometry.computeBoundingBox();
                    
                    // Enable shadows for all STL meshes
                    geometry.userData = { castShadow: true, receiveShadow: true };
                    
                    resolve(geometry);
                },
                undefined,
                error => reject(error)
            );
        });
    }

    setJointValue(jointName, value) {
        const joint = this.joints.get(jointName);
        if (joint) {
            return joint.setJointValue(value);
        }
        return false;
    }

    getJointValue(jointName) {
        const joint = this.joints.get(jointName);
        if (joint && joint.jointValue.length > 0) {
            return joint.jointValue[0];
        }
        return 0;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Update animation if active
        this.updateAnimation();
        
        if (this.controls) {
            this.controls.update();
        }
        
        // Optimized rendering with frustum culling
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize(containerId) {
        const container = document.getElementById(containerId);
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    // Set calibration data
    setCalibrationData(calibrationData) {
        this.calibrationData = calibrationData;
        console.log('URDFLoader: Calibration data set:', calibrationData);
    }

    // Get calibration data
    getCalibrationData() {
        return this.calibrationData;
    }

    // Convert servo position using calibration data
    convertServoPositionWithCalibration(servoId, servoPosition, jointName, jointMapping = null) {
        if (!this.calibrationData[jointName]) {
            // Fall back to default conversion
            return this.convertServoPositionDefault(servoId, servoPosition, jointName);
        }

        const calibration = this.calibrationData[jointName];
        const servoMin = calibration.openPosition;
        const servoMax = calibration.closedPosition;
        const jointMin = 0; // Open position
        const jointMax = calibration.closedJointAngle; // Calibrated closed position
        const multiplier = calibration.multiplier || 1.0;
        const offset = calibration.offset || 0.0;

        // Normalize servo position to 0-1
        const normalized = (servoPosition - servoMin) / (servoMax - servoMin);
        const clamped = Math.max(0, Math.min(1, normalized));
        
        // Convert to joint angle using calibration
        let jointAngle = jointMin + clamped * (jointMax - jointMin);
        
        // Apply multiplier and offset
        jointAngle = jointAngle * multiplier + offset;
        
        // Special handling for thumb abduction (servo_12) - invert direction
        if (servoId === 'servo_12') {
            jointAngle = jointMax - jointAngle; // Invert angle
        }
        
        console.log(`URDFLoader: Calibrated conversion for ${jointName} - servo ${servoPosition} -> joint ${jointAngle}`);
        return jointAngle;
    }

    // Default servo position conversion (fallback)
    convertServoPositionDefault(servoId, servoPosition, jointName) {
        const servoLimits = {
            'servo_1': { min: 20, max: 500 },
            'servo_2': { min: 98, max: 500 },
            'servo_3': { min: 279, max: 500 },
            'servo_4': { min: 20, max: 400 },
            'servo_5': { min: 20, max: 450 },
            'servo_6': { min: 20, max: 500 },
            'servo_7': { min: 20, max: 400 },
            'servo_8': { min: 20, max: 500 },
            'servo_9': { min: 20, max: 400 },
            'servo_10': { min: 20, max: 500 },
            'servo_12': { min: 20, max: 520 }
        };

        const limits = servoLimits[servoId];
        if (!limits) return 0;

        const servoMin = limits.min;
        const servoMax = limits.max;
        const normalized = (servoPosition - servoMin) / (servoMax - servoMin);
        const invertedNormalized = 1 - normalized;
        
        // Invert thumb abduction (servo_12) direction
        if (servoId === 'servo_12') {
            return normalized * 1.57; // Use normalized instead of inverted for thumb abduction
        }
        
        return invertedNormalized * 1.57; // Max joint angle
    }

    // Set servo positions with calibration
    setServoPositions(servoPositions, animate = false, duration = 200) {
        if (!this.robot) return;

        // DIP joint mapping - DIP joints that move with their corresponding PIP joints
        const dipJointMapping = {
            'pinky_pip': 'pinky_dip',   // Pinky DIP moves with Pinky PIP
            'ring_pip': 'ring_dip',     // Ring DIP moves with Ring PIP
            'middle_pip': 'middle_dip', // Middle DIP moves with Middle PIP
            'index_pip': 'index_dip',   // Index DIP moves with Index PIP
            'thumb_pip': 'thumb_dip'    // Thumb DIP moves with Thumb PIP
        };

        const targetValues = {};
        
        for (const [servoId, servoPosition] of Object.entries(servoPositions)) {
            const jointNames = this.getJointsForServo(servoId);
            
            for (const jointName of jointNames) {
                const jointAngle = this.convertServoPositionWithCalibration(servoId, servoPosition, jointName);
                targetValues[jointName] = jointAngle;
                
                // Move corresponding DIP joint if it exists
                const dipJointName = dipJointMapping[jointName];
                if (dipJointName) {
                    targetValues[dipJointName] = jointAngle;
                }
            }
        }

        if (animate) {
            this.animateJoints(targetValues, duration);
        } else {
            for (const [jointName, angle] of Object.entries(targetValues)) {
                this.setJointValue(jointName, angle);
            }
        }
    }

    // Get joints associated with a servo
    getJointsForServo(servoId) {
        const jointMapping = {
            'servo_1': ['pinky_pip'],
            'servo_2': ['ring_pip'],
            'servo_3': ['ring_mcp'],
            'servo_4': ['middle_mcp'],
            'servo_5': ['middle_pip'],
            'servo_6': ['index_pip'],
            'servo_7': ['pinky_mcp'],
            'servo_8': ['index_mcp'],
            'servo_9': ['thumb_mcp'],
            'servo_10': ['thumb_pip', 'thumb_dip'], // Combined PIP and DIP
            'servo_12': ['thumb_abduction']
        };
        
        return jointMapping[servoId] || [];
    }

    // Get servo positions from current joint values
    getServoPositions() {
        if (!this.robot) return {};

        const servoPositions = {};
        const jointMapping = {
            'servo_1': 'pinky_pip',
            'servo_2': 'ring_pip',
            'servo_3': 'ring_mcp',
            'servo_4': 'middle_mcp',
            'servo_5': 'middle_pip',
            'servo_6': 'index_pip',
            'servo_7': 'pinky_mcp',
            'servo_8': 'index_mcp',
            'servo_9': 'thumb_mcp',
            'servo_10': 'thumb_pip',
            'servo_12': 'thumb_abduction'
        };

        for (const [servoId, jointName] of Object.entries(jointMapping)) {
            const joint = this.joints.get(jointName);
            if (joint) {
                const angle = joint.angle;
                // Convert joint angle back to servo position
                const servoPosition = this.convertJointAngleToServoPosition(servoId, angle, jointName);
                servoPositions[servoId] = servoPosition;
            }
        }

        return servoPositions;
    }

    // Convert joint angle back to servo position
    convertJointAngleToServoPosition(servoId, jointAngle, jointName) {
        if (!this.calibrationData[jointName]) {
            return this.convertJointAngleToServoPositionDefault(servoId, jointAngle);
        }

        const calibration = this.calibrationData[jointName];
        const servoMin = calibration.openPosition;
        const servoMax = calibration.closedPosition;
        const jointMin = 0;
        const jointMax = calibration.closedJointAngle;
        const multiplier = calibration.multiplier || 1.0;
        const offset = calibration.offset || 0.0;

        // Remove multiplier and offset
        let normalizedAngle = (jointAngle - offset) / multiplier;
        
        // Special handling for thumb abduction
        if (servoId === 'servo_12') {
            normalizedAngle = jointMax - normalizedAngle;
        }

        // Convert to normalized position (0-1)
        const normalized = (normalizedAngle - jointMin) / (jointMax - jointMin);
        const clamped = Math.max(0, Math.min(1, normalized));
        
        // Convert to servo position
        const servoPosition = Math.round(servoMin + clamped * (servoMax - servoMin));
        
        return servoPosition;
    }

    // Default conversion from joint angle to servo position
    convertJointAngleToServoPositionDefault(servoId, jointAngle) {
        const servoLimits = {
            'servo_1': { min: 20, max: 500 },
            'servo_2': { min: 98, max: 500 },
            'servo_3': { min: 279, max: 500 },
            'servo_4': { min: 20, max: 400 },
            'servo_5': { min: 20, max: 450 },
            'servo_6': { min: 20, max: 500 },
            'servo_7': { min: 20, max: 400 },
            'servo_8': { min: 20, max: 500 },
            'servo_9': { min: 20, max: 400 },
            'servo_10': { min: 20, max: 500 },
            'servo_12': { min: 20, max: 520 }
        };

        const limits = servoLimits[servoId];
        if (!limits) return 0;

        const servoMin = limits.min;
        const servoMax = limits.max;
        
        // Convert joint angle to normalized position
        let normalized;
        if (servoId === 'servo_12') {
            normalized = jointAngle / 1.57; // Use direct mapping for thumb abduction
        } else {
            normalized = 1 - (jointAngle / 1.57); // Invert for other joints
        }
        
        const clamped = Math.max(0, Math.min(1, normalized));
        const servoPosition = Math.round(servoMin + clamped * (servoMax - servoMin));
        
        return servoPosition;
    }

    // Animate joints to target values
    animateJoints(targetValues, duration = 200, onComplete = null) {
        console.log('URDFLoader: Starting animation with target values:', targetValues);
        this.animationStartTime = performance.now();
        this.animationDuration = duration;
        this.animationTargetValues = { ...targetValues };
        this.animationOnComplete = onComplete;

        // Store start values
        this.animationStartValues = {};
        for (const [jointName, targetValue] of Object.entries(targetValues)) {
            const joint = this.joints.get(jointName);
            if (joint) {
                this.animationStartValues[jointName] = joint.angle;
                console.log(`URDFLoader: Joint ${jointName} start: ${joint.angle}, target: ${targetValue}`);
            } else {
                console.warn(`URDFLoader: Joint ${jointName} not found`);
            }
        }
    }

    // Stop animation
    stopAnimation() {
        this.animationStartTime = 0;
        this.animationDuration = 0;
        this.animationTargetValues = {};
        this.animationStartValues = {};
        this.animationOnComplete = null;
    }

    // Update animation
    updateAnimation() {
        if (this.animationStartTime === 0) return;

        const elapsed = performance.now() - this.animationStartTime;
        const progress = Math.min(elapsed / this.animationDuration, 1);
        const easedProgress = this.easeInOutCubic(progress);

        let allComplete = true;
        for (const [jointName, targetValue] of Object.entries(this.animationTargetValues)) {
            const joint = this.joints.get(jointName);
            if (joint) {
                const startValue = this.animationStartValues[jointName] || 0;
                const currentValue = startValue + (targetValue - startValue) * easedProgress;
                joint.setJointValue(currentValue);
                
                // Animation progress
                if (progress > 0.5 && progress < 0.51) {
                    console.log(`URDFLoader: Animation progress ${(progress * 100).toFixed(1)}% - ${jointName}: ${currentValue.toFixed(3)}`);
                }
            }
        }

        if (progress >= 1) {
            console.log('URDFLoader: Animation completed');
            this.stopAnimation();
            if (this.animationOnComplete) {
                this.animationOnComplete();
            }
        }
    }

    // Easing function
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}

window.URDFLoader = URDFLoader; 