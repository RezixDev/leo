class SoundDetector {
    constructor(threshold = 0.4) { // Increased threshold for better mobile detection
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.analyzer = null;
        this.threshold = threshold;
        this.isEnabled = false;
        this.callback = null;
        this.meterElement = document.querySelector('.meter-fill');
        this.stream = null;
        this.lastTriggerTime = 0;
        this.cooldownPeriod = 1000; // 1 second cooldown between triggers
    }

    async init() {
        try {
            if (this.audioContext) {
                await this.audioContext.close();
            }
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = 1024; // Increased for better accuracy
            this.mediaStreamSource.connect(this.analyzer);
            this.isEnabled = true;
            this.monitor();
        } catch (err) {
            console.error('Error initializing audio:', err);
            alert('Unable to access microphone. Please ensure microphone permissions are granted.');
        }
    }

    monitor() {
        if (!this.isEnabled) return;

        const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
        const update = () => {
            if (!this.isEnabled) return;
            
            this.analyzer.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const normalizedValue = average / 256;

            if (this.meterElement) {
                this.meterElement.style.width = `${normalizedValue * 100}%`;
            }

            const currentTime = Date.now();
            if (normalizedValue > this.threshold && 
                currentTime - this.lastTriggerTime > this.cooldownPeriod && 
                this.callback) {
                this.lastTriggerTime = currentTime;
                this.callback();
            }

            requestAnimationFrame(update);
        };
        update();
    }
    setCallback(callback) {
        this.callback = callback;
    }



    stop() {
        this.isEnabled = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.meterElement) {
            this.meterElement.style.width = '0%';
        }
    }
}

class CameraManager {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.context = this.canvas.getContext('2d');
        this.stream = null;
        this.facingMode = 'user';
    }

    async start() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            this.video.srcObject = this.stream;
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Unable to access camera');
        }
    }

    async switchCamera() {
        this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
        await this.start();
    }

    takePhoto() {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        this.stop();
        return this.canvas.toDataURL('image/png');
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }
}

class FileUploadManager {
    constructor(guitarInputId, backgroundInputId) {
        this.guitarInput = document.getElementById(guitarInputId);
        this.backgroundInput = document.getElementById(backgroundInputId);
        this.customGuitarOption = document.querySelector('.guitar-option.custom-option');
        this.backgroundOverlay = document.getElementById('backgroundOverlay');
        this.backgroundControls = document.querySelector('.background-controls');
        this.setupListeners();
        this.setupBackgroundControls();
    }

    setupBackgroundControls() {
        const bgSizeSlider = document.getElementById('bgSizeSlider');
        const bgXPosSlider = document.getElementById('bgXPosSlider');
        const bgYPosSlider = document.getElementById('bgYPosSlider');

        const updateBackgroundPosition = () => {
            const size = bgSizeSlider.value;
            const xPos = bgXPosSlider.value;
            const yPos = bgYPosSlider.value;

            this.backgroundOverlay.style.width = `${size}%`;
            this.backgroundOverlay.style.height = `${size}%`;
            this.backgroundOverlay.style.transform = `translate(-50%, -50%) translate(${(xPos - 50)}%, ${(yPos - 50)}%)`;
        };

        [bgSizeSlider, bgXPosSlider, bgYPosSlider].forEach(slider => {
            slider.addEventListener('input', updateBackgroundPosition);
        });
    }

    setupListeners() {
        this.setupDragAndDrop('guitarUpload', this.handleGuitarFile.bind(this));
        this.setupDragAndDrop('backgroundUpload', this.handleBackgroundFile.bind(this));
        
        this.guitarInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.handleGuitarFile(e.target.files[0]);
        });
        
        this.backgroundInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.handleBackgroundFile(e.target.files[0]);
        });
    }

    setupDragAndDrop(containerId, handleFile) {
        const container = document.getElementById(containerId);
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('dragover');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('dragover');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('dragover');
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });

        container.addEventListener('click', () => {
            const input = container.querySelector('.file-input');
            input.click();
        });
    }

    handleGuitarFile(file) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Update custom guitar option
                    this.customGuitarOption.querySelector('img').src = e.target.result;
                    this.customGuitarOption.style.display = 'block';
                    
                    // Select the custom guitar option
                    document.querySelectorAll('.guitar-option').forEach(opt => {
                        opt.style.borderColor = 'transparent';
                    });
                    this.customGuitarOption.style.borderColor = '#4CAF50';
                    
                    // Set the guitar overlay
                    const guitarOverlay = document.getElementById('guitarOverlay');
                    guitarOverlay.src = e.target.result;
                    guitarOverlay.style.display = 'block';
                    
                    // Reset and show controls
                    document.querySelector('.controls-panel').style.display = 'block';
                    
                    // Reset the sliders to default center position
                    const sizeSlider = document.getElementById('sizeSlider');
                    const xPosSlider = document.getElementById('xPosSlider');
                    const yPosSlider = document.getElementById('yPosSlider');
                    const rotationSlider = document.getElementById('rotationSlider');
                    
                    sizeSlider.value = 50; // Start with smaller size
                    xPosSlider.value = 50;
                    yPosSlider.value = 50;
                    rotationSlider.value = 0;
                    
                    this.updateGuitarOverlay();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please upload an image file.');
        }
    }

  
    handleBackgroundFile(file) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.backgroundOverlay.src = e.target.result;
                    this.backgroundOverlay.style.display = 'block';
                    
                    // Reset background position and sizing
                    this.backgroundOverlay.style.position = 'absolute';
                    this.backgroundOverlay.style.left = '50%';
                    this.backgroundOverlay.style.top = '50%';
                    this.backgroundOverlay.style.transform = 'translate(-50%, -50%)';
                    this.backgroundOverlay.style.width = '100%';
                    this.backgroundOverlay.style.height = '100%';
                    this.backgroundOverlay.style.objectFit = 'cover';
                    
                    // Show background controls
                    this.backgroundControls.style.display = 'block';
                    
                    // Reset sliders to default values
                    document.getElementById('bgSizeSlider').value = 100;
                    document.getElementById('bgXPosSlider').value = 50;
                    document.getElementById('bgYPosSlider').value = 50;
                    
                    // Hide the video element if it's showing
                    const video = document.getElementById('video');
                    const canvas = document.getElementById('canvas');
                    if (video) video.style.display = 'none';
                    if (canvas) canvas.style.display = 'none';
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please upload an image file.');
        }
    }



}


// Main App
document.addEventListener('DOMContentLoaded', () => {
    const camera = new CameraManager();
    const soundDetector = new SoundDetector(0.3);
    const fileUploadManager = new FileUploadManager('guitarFileInput', 'backgroundFileInput');

    const videoContainer = document.querySelector('.camera-section');
    const controlsPanel = document.querySelector('.controls-panel');
    videoContainer.parentNode.insertBefore(controlsPanel, videoContainer.nextSibling);

    controlsPanel.classList.add('mt-4', 'mb-4');
    const controlLabels = {
        sizeSlider: 'Size',
        xPosSlider: 'Left/Right Position',
        yPosSlider: 'Up/Down Position',
        rotationSlider: 'Rotation'
    };

    Object.entries(controlLabels).forEach(([id, label]) => {
        const slider = document.getElementById(id);
        if (slider) {
            const labelElement = slider.previousElementSibling;
            if (labelElement) {
                labelElement.textContent = label;
                labelElement.classList.add('font-bold', 'text-lg', 'mb-2');
            }
        }
    });

    const style = document.createElement('style');
    style.textContent = `
        .controls-panel {
            background-color: #f8f9fa;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .slider-control {
            margin-bottom: 1.5rem;
        }

        .slider-control:last-child {
            margin-bottom: 0;
        }

        input[type="range"] {
            width: 100%;
            height: 8px;
            border-radius: 4px;
            background: #e9ecef;
            outline: none;
            -webkit-appearance: none;
        }

        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #4CAF50;
            cursor: pointer;
        }

        .meter-fill {
            transition: width 100ms ease-out;
        }
    `;
    document.head.appendChild(style);
    
    const elements = {
        video: document.getElementById('video'),
        canvas: document.getElementById('canvas'),
        startButton: document.getElementById('startCamera'),
        takePhotoButton: document.getElementById('takePhoto'),
        retakeButton: document.getElementById('retake'),
        switchCameraButton: document.getElementById('switchCamera'),
        toggleGuideButton: document.getElementById('toggleGuide'),
        toggleSoundButton: document.getElementById('toggleSound'),
        useCameraBtn: document.getElementById('useCameraBtn'),
        useUploadBtn: document.getElementById('useUploadBtn'),
        uploadContainer: document.getElementById('uploadContainer'),
        backgroundOverlay: document.getElementById('backgroundOverlay'),
        controlsPanel: document.querySelector('.controls-panel'),
        guitarOptions: document.querySelector('.guitar-options'),
        soundMeter: document.getElementById('soundLevel') // Add this line to fix the sound meter reference
    };

    const useCameraBtn = document.getElementById('useCameraBtn');
    const useUploadBtn = document.getElementById('useUploadBtn');
    const uploadContainer = document.getElementById('uploadContainer');

    // Check if device has multiple cameras
    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length > 1) {
                elements.switchCameraButton.style.display = 'block';
            }
        });

    // Setup event listeners
 // Setup event listeners
 elements.startButton.addEventListener('click', async () => {
    await camera.start();
    elements.startButton.style.display = 'none';
    elements.takePhotoButton.style.display = 'block';
});

elements.takePhotoButton.addEventListener('click', () => {
    const photoData = camera.takePhoto();
    elements.video.style.display = 'none';
    elements.canvas.style.display = 'block';
    elements.takePhotoButton.style.display = 'none';
    elements.retakeButton.style.display = 'block';
    elements.guitarOptions.style.display = 'grid';
    elements.controlsPanel.style.display = 'block'; // Show controls right away
    elements.soundMeter.style.display = 'none';
    soundDetector.stop();
});

elements.retakeButton.addEventListener('click', async () => {
    await camera.start();
    elements.video.style.display = 'block';
    elements.canvas.style.display = 'none';
    elements.retakeButton.style.display = 'none';
    elements.takePhotoButton.style.display = 'block';
    elements.guitarOptions.style.display = 'none';
    elements.controlsPanel.style.display = 'none';
    elements.guitarOverlay.src = '';
});

elements.useCameraBtn.addEventListener('click', () => {
    elements.useCameraBtn.classList.add('active');
    elements.useUploadBtn.classList.remove('active');
    elements.uploadContainer.style.display = 'none';
    elements.video.style.display = 'block';
    elements.startButton.style.display = 'block';
    elements.backgroundOverlay.style.display = 'none';
});

elements.useUploadBtn.addEventListener('click', () => {
    elements.useUploadBtn.classList.add('active');
    elements.useCameraBtn.classList.remove('active');
    elements.uploadContainer.style.display = 'block';
    elements.video.style.display = 'none';
    elements.startButton.style.display = 'none';
    camera.stop();
});


elements.switchCameraButton.addEventListener('click', () => {
    camera.switchCamera();
});

elements.toggleGuideButton.addEventListener('click', () => {
    const postureGuide = document.querySelector('.posture-guide');
    const isVisible = postureGuide.style.display === 'block';
    postureGuide.style.display = isVisible ? 'none' : 'block';
    elements.toggleGuideButton.textContent = isVisible ? 'Show Posture Guide' : 'Hide Posture Guide';
});

let soundTriggerEnabled = false;
elements.toggleSoundButton.addEventListener('click', async () => {
    soundTriggerEnabled = !soundTriggerEnabled;
    elements.toggleSoundButton.textContent = soundTriggerEnabled ? 'Disable Sound Trigger' : 'Enable Sound Trigger';
    
    if (elements.soundMeter) {  // Add null check
        elements.soundMeter.style.display = soundTriggerEnabled ? 'block' : 'none';
    }

    if (soundTriggerEnabled) {
        await soundDetector.init();
        soundDetector.setCallback(() => {
            if (elements.takePhotoButton.style.display === 'block') {
                elements.takePhotoButton.click();
            }
        });
    } else {
        soundDetector.stop();
    }
});

// Guitar selection and controls
const guitarOptions = document.querySelectorAll('.guitar-option');
    const sizeSlider = document.getElementById('sizeSlider');
    const xPosSlider = document.getElementById('xPosSlider');
    const yPosSlider = document.getElementById('yPosSlider');
    const rotationSlider = document.getElementById('rotationSlider');

    guitarOptions.forEach(option => {
        option.addEventListener('click', () => {
            const guitarType = option.dataset.guitar;
            const guitarOverlay = document.getElementById('guitarOverlay');
            guitarOverlay.src = option.querySelector('img').src;
            elements.controlsPanel.style.display = 'block';

            guitarOptions.forEach(opt => {
                opt.style.borderColor = opt === option ? '#4CAF50' : 'transparent';
            });

            // Reset controls to default values
            sizeSlider.value = 100;
            xPosSlider.value = 50;
            yPosSlider.value = 50;
            rotationSlider.value = 0;
            updateGuitarOverlay();
        });
    });
    function updateGuitarOverlay() {
        const guitarOverlay = document.getElementById('guitarOverlay');
        const size = document.getElementById('sizeSlider').value;
        const xPos = document.getElementById('xPosSlider').value;
        const yPos = document.getElementById('yPosSlider').value;
        const rotation = document.getElementById('rotationSlider').value;
    
        // Calculate size based on the slider value (10-200 range)
        const scaledSize = size * 0.8; // Max 80% of container
        
        guitarOverlay.style.width = `${scaledSize}%`;
        guitarOverlay.style.left = `${xPos}%`;
        guitarOverlay.style.top = `${yPos}%`;
        guitarOverlay.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    }

    [sizeSlider, xPosSlider, yPosSlider, rotationSlider].forEach(slider => {
        slider.addEventListener('input', updateGuitarOverlay);
    });


// Handle visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        camera.stop();
        soundDetector.stop();
    }
});

// Handle errors
const handleError = (error) => {
    console.error('App Error:', error);
    alert('An error occurred. Please refresh the page and try again.');
};

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', (event) => handleError(event.reason));
});