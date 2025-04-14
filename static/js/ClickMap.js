/**
 * PageElement that handles the display and input from
 * a map or other clickable image which can return the coordinates
 * on which the user clicked set
 * Used primarily in geolocation questions in which it displays a world map
 */
class ClickMap extends PageElement {

    constructor() {
        super('click-container', ['geolocation','kazakhstan'])
        this.isPlayableComponent = true;
        this.answerx = null;
        this.answery = null;
        this.markerSize = 50;
        this.scale = 1;
        this.viewBox = { x: 0, y: 0, width: 1000, height: 500 };
        // mouse
        this.mx = null;
        this.my = null;
        this.prevmx = null;
        this.prevmy = null;
        this.dragx = 0.0;
        this.dragy = 0.0;
        this.isDragging = false;
        //this.hasMoved = false;
        this.clickStartTime = 0;
        this.moveThreshold = 5; // pixels of movement to consider it a drag
        this.clickTimeThreshold = 200; // milliseconds to consider it a click
        this.secondPointerDown = false;
        this.currentMarker = null;
        // dimensions etc
        this.startPoint = { x: 0, y: 0 };
        this.viewBoxStart = { x: 0, y: 0 };
        this.imagePath = null;
        this.svg = null;
        this.imageWidth = null;
        this.imageHeight = null;
        // pinch zooming variables
        this.initialPinchDistance = 0;
        this.initialScale = 1;
        this.lastScale = 1;
        // Initialize events after adding to DOM
        this.initializeEvents();
    }

    createStyles() {
        let css = `
            .click-container {
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                background-color: var(--bccblue);
                margin: 10px, 0;
                border: 1px inset white;
                overflow: hidden;
            }

            .click-container svg {
                display: block;
                pointer-events: all;
                user-select: none;
                -webkit-user-select: none;
            }
        `;
        return css;
    }

    shouldShow() {
        let cq = this.getCurrentQuestion();
        if (!cq || !cq.clickImage) {
            return false;
        }
        return true;
    }

    /*
    shouldUpdate() {
        // if we've not been properly instantiated yet
        if (!this.svg) {return true;}
        if (!this.imagePath) {return true;}
        // if we have the relevant quesiton data
        this.info("in should update in clickmap");
        if (!cq.clickImage) {return false;}
        // if this is a new question
        if (cq.clickImage !== this.imagePath) {
            return true;
        }
        return false;
    }
    */

    getContent(gs) {
        let cq = this.getCurrentQuestion();
        // This check is now in getContent, but it's being overridden by getAnswerContent
        // We'll remove this check from here since it's now handled in getAnswerContent
        this.imagePath = cq.clickImage;
        
        let rawSvg = this.getApi().getFileContent(this.imagePath);

        if (!rawSvg) {
            this.warn('Error: No SVG content loaded');
            return null;
        }

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
        const originalSvg = svgDoc.documentElement;

        // Validate that we have a valid SVG
        if (originalSvg.nodeName !== 'svg') {
            this.warn('Error: Invalid SVG document');
            return null;
        }

        // Safely get dimensions with fallbacks
        let width = originalSvg.getAttribute('width');
        let height = originalSvg.getAttribute('height');
        let viewBox = originalSvg.getAttribute('viewBox');

        // Parse viewBox if it exists
        let viewBoxValues = viewBox ? viewBox.split(' ').map(Number) : null;

        // Set dimensions with fallbacks
        this.imageWidth = width ? parseFloat(width) :
                         (viewBoxValues ? viewBoxValues[2] : 800); // default width

        this.imageHeight = height ? parseFloat(height) :
                          (viewBoxValues ? viewBoxValues[3] : 600); // default height

        this.markerSize = Math.round(this.imageWidth / 50);
        // Copy the original SVG
        this.svg = originalSvg;

        // Set SVG to fill container completely
        this.svg.style.width = "100%";
        this.svg.style.height = "100%";
        this.svg.style.display = "block"; // Removes any inline spacing

        // Ensure viewBox exists
        if (!viewBox) {
            this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
        }

        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Ensures proper scaling

        return this.svg;
    }

    parseCoordinates(coords) {
        if (!coords) {return [null, null];}
        try {
            // Handle both comma and hyphen separated coordinates
            const coordinates = coords.includes(',')
                ? coords.split(',')
                : coords.split('-');

            if (coordinates.length !== 2) {
                this.warn(`Invalid coordinate format: ${coords}`);
                return [null, null];
            }

            const x = parseFloat(coordinates[0].trim());
            const y = parseFloat(coordinates[1].trim());

            // Validate parsed coordinates
            if (isNaN(x) || isNaN(y)) {
                this.warn(`Invalid coordinate values: x=${x}, y=${y}`);
                return [null, null];
            }
            return [x, y];
        } catch (error) {
            this.warn(`Error processing answer: ${error.message}`);
            return [null, null];
        }
    }

    getAnswerContent(api) {
        let cq = this.getCurrentQuestion();
        if (!Object.hasOwn(cq, "answers"))  {
            this.info("NO answers array");
            return null;
        }
        if (cq.answers.length == 0) {
            this.info("CQ.answers is zero length");
            return null;
        }

        // First get the base SVG content
        // Temporarily store the original imagePath
        const originalImagePath = this.imagePath;
        
        // Check if we have an answer image
        if (Object.hasOwn(cq, "answerImage") && cq.answerImage) {
            // Directly load the answer image instead of using getContent
            this.info("Loading answer image: " + cq.answerImage);
            let rawSvg = this.getApi().getFileContent(cq.answerImage);
            
            if (!rawSvg) {
                this.warn('Error: No answer SVG content loaded');
                // Fall back to the regular image
                this.imagePath = originalImagePath;
                rawSvg = this.getApi().getFileContent(cq.clickImage);
                if (!rawSvg) {
                    return null;
                }
            }
            
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
            const answerSvg = svgDoc.documentElement;
            
            // Validate that we have a valid SVG
            if (answerSvg.nodeName !== 'svg') {
                this.warn('Error: Invalid SVG document');
                return null;
            }
            
            // Set up the SVG with the same properties we'd use in getContent
            let width = answerSvg.getAttribute('width');
            let height = answerSvg.getAttribute('height');
            let viewBox = answerSvg.getAttribute('viewBox');
            
            // Parse viewBox if it exists
            let viewBoxValues = viewBox ? viewBox.split(' ').map(Number) : null;
            
            // Set dimensions with fallbacks
            this.imageWidth = width ? parseFloat(width) :
                             (viewBoxValues ? viewBoxValues[2] : 800);
            
            this.imageHeight = height ? parseFloat(height) :
                              (viewBoxValues ? viewBoxValues[3] : 600);
            
            this.markerSize = Math.round(this.imageWidth / 50);
            
            // Copy the SVG
            this.svg = answerSvg;
            
            // Set SVG to fill container completely
            this.svg.style.width = "100%";
            this.svg.style.height = "100%";
            this.svg.style.display = "block";
            
            // Ensure viewBox exists
            if (!viewBox) {
                this.svg.setAttribute("viewBox", `0 0 ${this.imageWidth} ${this.imageHeight}`);
            }
            
            this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
            
            // Use this as our return value
            let ret = this.svg;
        } else {
            // No answer image, use the regular content
            this.info("No answer image available, using regular image");
            let ret = this.getContent(api);
            if (!ret) {
                return null;
            }
        }
        
        // Define colors for different answers
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'
        ];

        // Add circles for each answer
        cq.answers.forEach((answer, index) => {
            let coords = this.parseCoordinates(answer.answer);
            const x = coords[0];
            const y = coords[1];
            // Validate parsed coordinates
            if (isNaN(x) || isNaN(y)) {
                this.warn(`Invalid coordinate values: x=${x}, y=${y}`);
                return;
            }
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", "5");
            circle.setAttribute("fill", colors[index % colors.length]);
            circle.setAttribute("fill-opacity", "0.6");
            circle.setAttribute("stroke", "#000000");
            circle.setAttribute("stroke-width", "1");

            const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
            title.textContent = `${answer.username}: ${answer.points} points`;
            circle.appendChild(title);
            this.svg.appendChild(circle);
        });
        
        // Add the correct answer marker
        if (cq.correctAnswers && cq.correctAnswers.length > 0) {
            let coords = this.parseCoordinates(cq.correctAnswers[0]);
            const x = coords[0];
            const y = coords[1];
            
            if (!isNaN(x) && !isNaN(y)) {
                const correctCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                correctCircle.setAttribute("cx", x);
                correctCircle.setAttribute("cy", y);
                correctCircle.setAttribute("r", "4");  // Smaller radius (was 8)
                correctCircle.setAttribute("fill", "#00FF00");  // Green
                correctCircle.setAttribute("fill-opacity", "0.4");  // More transparent (was 0.7)
                correctCircle.setAttribute("stroke", "#000000");
                correctCircle.setAttribute("stroke-width", "1");  // Thinner stroke (was 2)
                
                const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                title.textContent = "Correct Answer";
                correctCircle.appendChild(title);
                this.svg.appendChild(correctCircle);
            }
        }
        
        return this.svg;
    }

    getAnswer() {
        let gs = GameAPI.getInstance();
        let a = gs.createAnswerObject();
        let cq = gs.getCurrentQuestion();
        let ap = cq.pointsAvailable;

        if (this.answerx === null || this.answery === null) {
            return null;
        }

        // Parse the correct answer coordinates
        const [correctX, correctY] = cq.correctAnswers[0]
            .replace(/\s+/g, '')
            .split(',')
            .map(num => parseFloat(num));

        // Calculate actual distance using Pythagorean theorem
        const dx = this.answerx - correctX;
        const dy = this.answery - correctY;
        const dt = Math.sqrt(dx * dx + dy * dy);
        // this is the pixels to miles ratio
        let miles = Math.round(dt * 3.4);  // Round to nearest whole number
        if (cq.type === "geolocation") {
            a.comment = `${miles} miles off`;
        } else {
            a.comment = `${Math.round(dt)} pixels away`;
        }

        // Calculate maximum possible error from correct point to each corner
        const distanceToCorners = [
            // Top-left corner
            Math.sqrt(
                (correctX - 0) * (correctX - 0) +
                (correctY - 0) * (correctY - 0)
            ),
            // Top-right corner
            Math.sqrt(
                (correctX - this.imageWidth) * (correctX - this.imageWidth) +
                (correctY - 0) * (correctY - 0)
            ),
            // Bottom-left corner
            Math.sqrt(
                (correctX - 0) * (correctX - 0) +
                (correctY - this.imageHeight) * (correctY - this.imageHeight)
            ),
            // Bottom-right corner
            Math.sqrt(
                (correctX - this.imageWidth) * (correctX - this.imageWidth) +
                (correctY - this.imageHeight) * (correctY - this.imageHeight)
            )
        ];

        // Maximum error is the distance to the furthest corner
        const maxError = Math.max(...distanceToCorners);

        // Calculate points based on some non-linear factor of error distance
        // in this case, exponential decay
        let pf = 5.0;
        if (cq.penalisationFactor) {pf = cq.penalisationFactor;}
        const accuracy = Math.exp(-10.0 * dt / maxError);
        a.points = Math.round(ap * accuracy * 10) / 10;

        // Ensure points don't go negative
        if (a.points < 0) a.points = 0.0;
        a.answer = `${this.answerx.toFixed(0)} - ${this.answery.toFixed(0)}`;

        this.info(`Distance: ${dt}, Max Error: ${maxError}, Points: ${a.points}`);
        return a;
    }

    /* Add method to create/update marker
       the image we are working with can be zoomed or dragged
       we want to be able to click on the image and have a marker
       displayed at the click location. the marker not scale with the
       rest of the image when zooming in and out but should remain the
       same size relative to the whole screen.
       Factors at play:
       * this.scale (the current scaling factor)
       * this.dragx and this.dragy (The amount by which the image has been dragged)
       * this.mx, this.my (The current mouse position)
       *
       * dragx is more positive when the image is dragged to the right
       * dragy is more positive when the image is dragged down
       * mx and my are the current mouse position
       * scale is the current scaling factor
       *
       * we need to calculate the position of the marker relative to the image
       * and then scale it up to the size of the image.
    */
    addMarker() {
        let screenX = this.mx;
        let screenY = this.my;

        // Remove existing marker if it exists
        if (this.currentMarker) {
            this.currentMarker.remove();
        }

        // Get the SVG's current transformation state
        const box = this.svg.viewBox.baseVal;

        // Get SVG's bounding rectangle for coordinate conversion
        const svgRect = this.svg.getBoundingClientRect();

        // Calculate position using the full viewBox dimensions
        const svgX = ((screenX - svgRect.left) / svgRect.width) * box.width + box.x;
        const svgY = ((screenY - svgRect.top) / svgRect.height) * box.height + box.y;

        // Create a circle element
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", svgX);
        circle.setAttribute("cy", svgY);
        circle.setAttribute("id", "markerId");  // Add ID for easier removal
        // make a note of where we placed the marker
        this.answerx = svgX;
        this.answery = svgY;

        this.info(`marker X: ${this.answerx}, marker Y: ${this.answery}`);

        // Make radius inversely proportional to zoom level
        const zoomAdjustedRadius = this.markerSize / this.scale;
        circle.setAttribute("r", zoomAdjustedRadius);

        circle.setAttribute("fill", "#FFFFFFA0");  // White with 60% opacity
        // Store reference to current marker
        this.currentMarker = circle;
        this.svg.appendChild(circle);
    }

    initializeEvents() {
        const container = this.getElement();
        if (!container) return;
        container.style.cursor = 'default';

        // Feature detection for passive support
        let passiveSupported = false;
        try {
            const opts = Object.defineProperty({}, 'passive', {
                get: function() {
                    passiveSupported = true;
                    return true;
                }
            });
            window.addEventListener("test", null, opts);
        } catch (e) {}

        // Set up passive options based on support
        const passiveOpts = passiveSupported ? { passive: true } : false;
        const nonPassiveOpts = { passive: false };

        // MOUSE MOVEMENT HANDLING
        container.addEventListener('mousemove', (e) => {
            if (!this.svg) return;

            // Update mouse position tracking
            this.prevmx = this.mx;
            this.prevmy = this.my;
            this.mx = e.clientX;
            this.my = e.clientY;

            if (this.isDragging) {
                const box = this.svg.viewBox.baseVal;
                const scale = box.width / this.svg.clientWidth;

                // Calculate the movement delta
                const dx = (this.mx - this.prevmx) * scale;
                const dy = (this.my - this.prevmy) * scale;

                // Update viewBox by moving it opposite to the drag direction
                box.x -= dx;
                box.y -= dy;
                this.dragx += dx;
                this.dragy += dy;
            }
        }, nonPassiveOpts);

        // MOUSE EXIT HANDLING
        container.addEventListener('mouseleave', (e) => {
            window.clearInterval();
            if (!this.svg) return;
            this.isDragging = false;
            container.style.cursor = 'default';
        }, passiveOpts);

        // MOUSE UP HANDLING
        container.addEventListener('mouseup', (e) => {
            window.clearInterval();
            if (!this.svg) return;
            container.style.cursor = 'default';
            if (this.isDragging) {
                this.isDragging = false;
            }
        }, passiveOpts);

        // MOUSE DOWN HANDLING
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!this.svg) return;
            window.clearInterval();
            let tx = e.clientX;
            let ty = e.clientY;
            window.setTimeout(() => {
                const dx = Math.abs(tx - this.mx);
                const dy = Math.abs(ty - this.my);
                if (dx > 1 || dy > 1) {
                    this.isDragging = true;
                    container.style.cursor = 'grabbing';
                } else {
                    this.isDragging = false;
                    container.style.cursor = 'default';
                    this.addMarker();
                }
            }, 350);
        }, nonPassiveOpts);

        // CONTAINER WHEEL ZOOM HANDLING
        container.addEventListener('wheel', (e) => {
            if (this.isDragging) return;
            const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.zoom(scaleFactor, mouseX, mouseY);
        }, passiveOpts);

        // PREVENT CTRL/CMD + WHEEL ZOOM IN CONTAINER
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        }, nonPassiveOpts);

        // TOUCH HANDLING FOR CONTAINER
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.mx = touch.clientX;
                this.my = touch.clientY;
                this.prevmx = this.mx;
                this.prevmy = this.my;
                this.isDragging = false;
                this.clickStartTime = Date.now();

                this.startPoint = {
                    x: touch.clientX,
                    y: touch.clientY
                };
                this.viewBoxStart = {
                    x: this.viewBox.x,
                    y: this.viewBox.y
                };
            } else if (e.touches.length === 2) {
                // Initialize pinch zoom
                this.secondPointerDown = true;
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.initialPinchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                this.initialScale = this.scale;
                this.lastScale = 1;
            }
        }, passiveOpts);

        // TOUCH MOVE HANDLING
        // invokes the existing non-touch handlers such as mousedown etc.
        container.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default touch behaviors

            if (e.touches.length === 1) {
                // Simulate mousedown for single touch
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                this.mx = touch.clientX;
                this.my = touch.clientY;
                this.prevmx = this.mx;
                this.prevmy = this.my;
                container.dispatchEvent(mouseEvent);
            }
            else if (e.touches.length === 2) {
                // Store initial distance for pinch zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.initialPinchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
            }
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                // Simulate mousemove
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                container.dispatchEvent(mouseEvent);
            }
            else if (e.touches.length === 2) {
                // Handle pinch zoom by simulating wheel event
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];

                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );

                // Calculate zoom direction based on pinch movement
                const delta = this.initialPinchDistance - currentDistance;

                // Calculate center point of the pinch
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;

                // Create and dispatch wheel event
                const wheelEvent = new WheelEvent('wheel', {
                    deltaY: delta,
                    clientX: centerX,
                    clientY: centerY,
                    bubbles: true
                });
                container.dispatchEvent(wheelEvent);

                // Update initial distance for next move event
                this.initialPinchDistance = currentDistance;
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            e.preventDefault();

            // Simulate mouseup
            const mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            container.dispatchEvent(mouseEvent);

            // Reset pinch zoom state
            this.initialPinchDistance = 0;
            this.isDragging = false;
            this.secondPointerDown = false;
        }, { passive: false });

        // POINTER EVENTS FOR PINCH DETECTION
        container.addEventListener('pointerdown', (e) => {
            if (e.isPrimary === false) {
                this.secondPointerDown = true;
            }
        }, passiveOpts);

        container.addEventListener('pointerup', (e) => {
            if (e.isPrimary === false) {
                this.secondPointerDown = false;
            }
        }, passiveOpts);

        // DOCUMENT-LEVEL EVENT HANDLERS
        // Prevent zooming outside of ClickMap etc.
        document.addEventListener('wheel', (e) => {
            if (!e.target.closest('.click-container') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
            }
        }, {
            passive: false,
            capture: true
        });

        // Prevent pinch zoom at document level except for click-container
        document.addEventListener('touchmove', (e) => {
            if (!e.target.closest('.click-container') && e.touches.length > 1) {
                e.preventDefault();
            }
        }, {
            passive: false,
            capture: true
        });

        // Prevent keyboard zoom shortcuts except when click-container is focused
        document.addEventListener('keydown', (e) => {
            if (!e.target.closest('.click-container') && (e.ctrlKey || e.metaKey)) {
                switch (e.key) {
                    case '+':
                    case '-':
                    case '=':
                    case '0':
                        e.preventDefault();
                        break;
                }
            }
        });

        // For wheel events that need preventDefault
        document.addEventListener('wheel', function(e) {
            // Only prevent Ctrl+wheel zoom outside of click-container
            if (!e.target.closest('.click-container') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
            }
        }, {
            passive: false,  // Explicitly set non-passive due to preventDefault() usage
            capture: true   // Use capture to handle event before it reaches other listeners
        });

        // For general wheel events that don't need preventDefault
        document.addEventListener('wheel', function(e) {
            if (e.target.closest('.click-container')) {
                // Handle click-container wheel events normally
                return;
            }
        }, {
            passive: true   // This one can be passive as it never calls preventDefault
        });

        // Prevent pinch zoom at document level EXCEPT for click-container
        document.addEventListener('touchmove', function(e) {
            // Allow the event if it's from the click-container
            if (e.target.closest('.click-container')) {
                return;
            }
            // Prevent pinch zoom everywhere else
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, {
            passive: false,  // Must be non-passive since we use preventDefault
            capture: true
        });

        // Prevent keyboard zoom shortcuts EXCEPT when click-container is focused
        document.addEventListener('keydown', function(e) {
            // Allow if the click-container or its children are focused
            if (e.target.closest('.click-container')) {
                return;
            }
            // Prevent Ctrl/Cmd + Plus/Minus/Zero
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '+':
                    case '-':
                    case '=':
                    case '0':
                        e.preventDefault();
                        break;
                }
            }
        });
        // Prevent zooming with more than one finger
        document.addEventListener('touchstart', function(e) {
            if (e.touches.length > 1) {
                e.preventDefault(); // Prevent zoom
            }
        }, { passive: false });

        // Prevent pinch zooming with gestures
        document.addEventListener('gesturestart', function(e) {
            e.preventDefault(); // Prevent zoom gesture
        }, { passive: false });
    }

    zoom(scaleFactor, centerX, centerY) {
        if (!this.svg) {
            this.warn('SVG element not initialized');
            return;
        }

        const newScale = this.scale * scaleFactor;

        // Limit zoom levels but allow zooming out to original size
        if (newScale < 1.0 || newScale > 15) return;

        // Get the current viewBox
        const box = this.svg.viewBox.baseVal;

        // Get SVG's bounding rectangle for coordinate conversion
        const svgRect = this.svg.getBoundingClientRect();

        // Calculate the point around which we're zooming (relative to viewBox)
        const centerPtX = (centerX / svgRect.width) * box.width + box.x;
        const centerPtY = (centerY / svgRect.height) * box.height + box.y;

        // Calculate new dimensions
        const newWidth = this.imageWidth / newScale;
        const newHeight = this.imageHeight / newScale;

        // Calculate new position to keep the center point at the same relative position
        box.x = centerPtX - (centerX / svgRect.width) * newWidth;
        box.y = centerPtY - (centerY / svgRect.height) * newHeight;
        box.width = newWidth;
        box.height = newHeight;

        // Update scale
        this.scale = newScale;

        // Adjust existing marker size if it exists
        if (this.currentMarker) {
            const zoomAdjustedRadius = this.markerSize / this.scale;
            this.currentMarker.setAttribute("r", zoomAdjustedRadius);
        }

        // Update the viewBox object
        this.viewBox = {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height
        };
    }
}