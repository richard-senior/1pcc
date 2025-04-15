/**
 * PageElement that handles the display and input from
 * a map or other clickable image which can return the coordinates
 * on which the user clicked set
 * Used primarily in geolocation questions in which it displays a world map
 */
class ClickMap extends PageElement {

    // Define a set of distinct colors for player markers
    static colors = [
        "#FF5733", // Red-Orange
        "#33FF57", // Green
        "#3357FF", // Blue
        "#FF33F5", // Pink
        "#F5FF33", // Yellow
        "#33FFF5", // Cyan
        "#8033FF", // Purple
        "#FF8033", // Orange
        "#33FF80", // Mint
        "#8080FF", // Lavender
        "#FF8080", // Salmon
        "#80FF80", // Light Green
        "#FFFF80", // Light Yellow
        "#80FFFF", // Light Blue
        "#FF80FF"  // Light Pink
    ];

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

    update(api) {
        this.doInitialise(api);
        if (!this.doShouldUpdate()) {return;}
        this.getStyles();

        let o = null;
        if (this.isShowAnswer()) {
            o = this.getAnswerContent(api)
        } else {
            o = this.getContent(api)
        }
        this.applyUpdate(o);
        this.updateHasRun = true;
    }

    getContent(gs) {
        let cq = this.getCurrentQuestion();
        let rawSvg = null;
        if (this.isShowAnswer()) {
            if (Object.hasOwn(cq, "answerImage") && cq.answerImage) {
                rawSvg = this.getApi().getFileContent(cq.answerImage);
            }
        }
        if (!rawSvg) {rawSvg = this.getApi().getFileContent(cq.clickImage);}
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

        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

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
        // start by repopulating the current svg, the image may have changed
        this.getContent();

        let cq = this.getCurrentQuestion();
        // First add the correct answer marker at the very beginning (bottom z-order)
        // This ensures it's drawn first and other elements appear on top
        if (cq.correctAnswers || cq.correctAnswers.length < 1) {return this.svg;}

        // Parse the coordinates for the correct answer
        let coords = this.parseCoordinates(cq.correctAnswers[0]);
        const x = coords[0];
        const y = coords[1];
        if (isNaN(x) && isNaN(y)) {return this.svg;}
        // draw the actual answer marker first
        let pm = this.drawMarker(x, y, "#000000", null);
        // now add answer markers
        if (!Object.hasOwn(cq, "answers") || cq.answers.length < 1) {return this.svg;}

        // Add circles for each answer with different colors and 80% opacity
        cq.answers.forEach((answer, index) => {
            let coords = this.parseCoordinates(answer.answer);
            const x = coords[0];
            const y = coords[1];
            // Select a color based on the index, cycling through the colors array
            const colorIndex = index % ClickMap.colors.length;
            const color = ClickMap.colors[colorIndex];
            let tm = this.drawMarker(x, y, color, answer.username);
        });
        // Always add the correct answer marker if available
        // We're removing this second marker since we already added it at the beginning
        // This prevents duplicate markers and ensures the correct z-order
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

    drawMarker(x, y, colour, id) {
        if (!this.svg) {return;}
        if (!x || !y || !colour) {return;}
        if (isNaN(x) || isNaN(y)) {return;}
        let screenX = x;
        let screenY = y;
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
        if (id) {circle.setAttribute("id", id);}
        // make a note of where we placed the marker
        this.answerx = svgX;
        this.answery = svgY;
        // Make radius inversely proportional to zoom level
        const zoomAdjustedRadius = this.markerSize / this.scale;
        circle.setAttribute("r", zoomAdjustedRadius);
        // Set fill color with 80% opacity - BLACK with WHITE outline
        circle.setAttribute("fill", colour);
        circle.setAttribute("fill-opacity", "0.8");  // 80% opacity
        circle.setAttribute("stroke", "#FFFFFF");  // White outline
        circle.setAttribute("stroke-width", "1");
        // Store reference to current marker
        this.currentMarker = circle;
        this.svg.appendChild(circle);
        return circle;
    }

    /* Add method to create/update marker when user clicks
    */
    addMarker() {
        let screenX = this.mx;
        let screenY = this.my;
        // Remove existing marker if it exists
        if (this.currentMarker) {this.currentMarker.remove();}
        this.drawMarker(screenX, screenY, "#000000", "markerId");
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