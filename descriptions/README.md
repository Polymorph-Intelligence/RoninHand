# RoninHand Robot Descriptions

This folder contains the robot description files for the RoninHand robotic hand system, including URDF and MJCF models for simulation and visualization.

## Contents

### Robot Model Files
- **`RoninHand.urdf`** - Universal Robot Description Format file for the RoninHand
- **`RoninHand.mjcf`** - MuJoCo XML format file for simulation
- **`mjcf_viewer.py`** - Python script to view the MJCF model in MuJoCo viewer

### 3D Mesh Files
The `meshes/` folder contains STL files for each component of the robotic hand:
- **`palm.stl`** - Main palm/base structure
- **`link1.stl`** - First finger link
- **`link2.stl`** - Second finger link  
- **`link3.stl`** - Third finger link
- **`link4.stl`** - Fourth finger link
- **`thumblink1.stl`** - Thumb link component

## Usage

### URDF Model
The URDF file is used by the main control interface for 3D visualization. It defines:
- Joint configurations and limits
- Link geometries and visual meshes
- Collision detection shapes
- Kinematic chain structure

### MJCF Model
The MJCF file is used for MuJoCo physics simulation and can be viewed using the provided Python script.

### Viewing the MJCF Model
```bash
cd descriptions
python mjcf_viewer.py
```

This will launch the MuJoCo viewer showing the RoninHand model. Press ESC to quit.

## Dependencies

### For MJCF Viewer
```bash
pip install mujoco mujoco-python-viewer
```

## File Structure
```
descriptions/
├── README.md              # This file
├── RoninHand.urdf         # Robot description for visualization
├── RoninHand.mjcf         # Robot description for simulation
├── mjcf_viewer.py         # MuJoCo viewer script
└── meshes/                # 3D mesh files
    ├── palm.stl
    ├── link1.stl
    ├── link2.stl
    ├── link3.stl
    ├── link4.stl
    └── thumblink1.stl
```

## Integration

These files are used by the main control interface in the `gesturecontrol/` folder:
- The URDF file is loaded by `urdf-loader.js` for 3D visualization
- The server.py serves these files to the web interface
- Mesh files are referenced by the URDF for visual representation 