# RoninHand Control Center

A comprehensive web-based control interface for the RoninHand robotic hand, featuring real-time 3D visualization, gesture control, hand tracking, and servo management.

## Features

### Control Modes

* **Gesture Mode**: Execute predefined hand gestures with real-time 3D visualization
* **Sequence Mode**: Create and run gesture sequences with customizable timing
* **Hand Tracking Mode**: Real-time hand tracking using MediaPipe for gesture control

### Tools & Utilities

* **Test Joint Limits**: Interactive testing of servo limits and ranges
* **Settings**: Configure servo limits, calibration, and system settings
* **Device Management**: Automatic port detection and connection management
* **URDF Model Support**: Real-time 3D rendering of the robotic hand
* **Gesture Management**: Add, edit, import/export custom gestures


## Prerequisites
### Hardware Requirements
- RoninHand 
- USB-to-serial adapter for communication with servo controller
- Webcam for hand tracking functionality (optional)

### Software Requirements
- **Python 3.7+**: For the backend server
- **Serial Port Access**: Proper permissions for USB communication

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Polymorph-Intelligence/RoninHand.git
cd RoninHand
```

### 2. Install Python Dependencies
```bash
cd gesturecontrol
pip install -r requirements.txt
```

### 3. Hardware Setup
1. Power on the RoninHand by connecting it to a power supply  
2. Connect it to your computer using a USB-to-serial adapter  
2. Note the COM port (Windows) or device path (Linux/macOS)
3. Ensure proper permissions for serial port access

### 4. Configuration
1. Configure servo limits and gestures within the web interface or edit `gestures.json`.
2. Calibrate the hand tracking if using that feature

## Usage

### Starting the Server
```bash
cd gesturecontrol
python server.py
```
The server will start on `http://localhost:8000`

### Web Interface
1. Open your browser and navigate to `http://localhost:8000`
2. Select your device from the dropdown and click "Connect"
3. Choose your desired control mode from the left panel

### Control Modes

#### Gesture Mode
- Select gestures from the dropdown or use gesture buttons
- Adjust servo positions with real-time sliders
- Save custom gestures for later use
- Enable thumb clearance for complex movements

#### Sequence Mode
- Create sequences of gestures with custom timing
- Edit existing sequences or create new ones
- Loop sequences for continuous operation
- Stop sequences at any time

#### Hand Tracking Mode (In Development)
- Click "Start Hand Tracking" to begin
- Select your camera from the dropdown
- Calibrate your hand range for optimal control
- Adjust mapping settings for responsiveness

#### Settings
- Configure servo limits for each joint
- Set animation and sequence timing
- Import/export gesture configurations
- Save calibration data

## File Structure

```
gesturecontrol/
├── README.md               # This file
├── index.html              # Main web interface
├── server.py               # Python backend server
├── urdf-loader.js          # 3D visualization engine
├── gestures.json           # Gesture and servo configuration
├── hand_calibration.json   # Hand tracking calibration data
├── requirements.txt        # Python dependencies
└── media/
    └── PolymorphLogo.png
```

## Configuration

### Servo Limits
Configure servo limits in `gestures.json`:
```json
{
  "servo_limits": {
    "servo_1": {"min": 20, "max": 500},
    "servo_2": {"min": 20, "max": 500},
    // ... more servos
  }
}
```

### Gestures
Define custom gestures in `gestures.json`:
```json
{
  "gestures": {
    "fist": {
      "servo_1": 500,
      "servo_2": 500,
      // ... servo positions
    }
  }
}
```

### Hand Tracking Calibration
Calibration data is stored in `hand_calibration.json` and can be adjusted through the web interface.

## Troubleshooting

### Connection Issues
- **Permission Denied**: Add user to dialout group (Linux) or run as Administrator (Windows)
- **Port Not Found**: Check device manager for correct COM port
- **Communication Error**: Verify baud rate and cable connections

### Hand Tracking Issues
- **Camera Not Found**: Refresh camera list or check browser permissions
- **Poor Tracking**: Adjust lighting and ensure hand is clearly visible
- **Calibration Problems**: Reset calibration and recalibrate hand range

### 3D Model Issues
- **Model Not Loading**: Check that URDF and mesh files are in correct locations in `descriptions/`
- **Joints Not Moving**: Verify joint names match between URDF and servo configuration
- **Performance Issues**: Reduce browser window size or disable hardware acceleration

## API Endpoints

### GET Endpoints
- `/` - Serve main interface
- `/gestures` - Get gesture and servo configuration
- `/current_positions` - Get current servo positions
- `/servo_limits` - Get servo limit configuration
- `/settings` - Get system settings
- `/available_ports` - List available serial ports
- `/urdf` - Get URDF model file
- `/meshes/*` - Serve 3D mesh files

### POST Endpoints
- `/update` - Update servo positions
- `/save` - Save gesture configuration
- `/execute` - Execute gesture with optional thumb clearance
- `/default` - Reset to default positions
- `/connect` - Connect to serial device
- `/add_gesture` - Add new gesture
- `/remove_gesture` - Remove gesture
- `/add_sequence` - Add gesture sequence
- `/update_sequence` - Update sequence
- `/update_servo_limits` - Update servo limits
- `/update_settings` - Update system settings
- `/save_calibration` - Save hand tracking calibration

## Dependencies

### Python Dependencies
The `requirements.txt` file contains:
- `feetech-servo-sdk` - For servo motor communication

### External Dependencies
- **Robot Model Files**: Located in `descriptions/` folder
  - URDF file for 3D visualization
  - Mesh files for visual representation

## Development

### TODO:
1. Improve mapping between MediaPipe hand pose tracking, URDF, and servo angles.
2. Extend `urdf-loader.js` for new functionality