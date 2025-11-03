/**
 * PageElement that handles the display and input from
 * a map or other clickable image which can return the coordinates
 * on which the user clicked set
 * Used primarily in geolocation questions in which it displays a world map
 */
class ClickMap extends PageElement {
    static markerIdPrefix = "playermarker";
    // Define a set of distinct colors for player markers
    static colors = [
        "#5F6B7A",
        "#E5E7EA",
        "#A65D21",
        "#687A61",
        "#404756",
        "#a4abbd",
        "#f9f871",
        "#00c6bb",
        "#fff7d6"
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

        // Get raw attributes
        let width = originalSvg.getAttribute('width');
        let height = originalSvg.getAttribute('height');
        let viewBox = originalSvg.getAttribute('viewBox');

        // Parse viewBox if it exists
        let viewBoxValues = null;
        if (viewBox) {
            // Use parseCoordinates for the viewBox since it's a pair of coordinates
            const [x, y] = this.parseCoordinates(viewBox.split(' ').slice(0, 2).join(','));
            // Use parseCoordinate for the dimensions
            const w = this.parseCoordinate(viewBox.split(' ')[2]);
            const h = this.parseCoordinate(viewBox.split(' ')[3]);

            if (x !== null && y !== null && w !== null && h !== null) {
                viewBoxValues = [x, y, w, h];
            } else {
                this.warn('Invalid viewBox format');
                viewBoxValues = null;
            }
        }

        // Set dimensions using parseCoordinate
        this.imageWidth = this.parseCoordinate(width) ||
                          (viewBoxValues ? viewBoxValues[2] : 800);
        this.imageHeight = this.parseCoordinate(height) ||
                           (viewBoxValues ? viewBoxValues[3] : 600);

        // Validate final dimensions
        if (!this.imageWidth || !this.imageHeight ||
            this.imageWidth <= 0 || this.imageHeight <= 0) {
            this.warn('Invalid image dimensions, using defaults');
            this.imageWidth = 800;
            this.imageHeight = 600;
        }

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

        this.info(`SVG initialized with dimensions ${this.imageWidth} x ${this.imageHeight}`);

        // draw marker for any answer the player has already submitted
        let a = this.getPlayerAnswer()
        if (a) {
            let coords = this.parseCoordinates(a.answer);
            let x = coords[0];
            let y = coords[1];
            if (x && y) {
                this.drawMarker(x, y, "#FFFFFF", ClickMap.markerIdPrefix);
            }
        }
        return this.svg;
    }

    parseCoordinate(value) {
        if (!value) return null;

        // Handle different types of input
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value === 'string') {
            // Remove any units/characters and convert to number
            const num = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
            return Number.isFinite(num) ? num : null;
        }

        return null;
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

            const x = this.parseCoordinate(coordinates[0].trim());
            const y = this.parseCoordinate(coordinates[1].trim());

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
        // this will be stored in this.svg so we can reference it directly
        this.getContent();
        // now get the location of markers from the current question
        let cq = this.getCurrentQuestion();
        // First add the correct answer marker at the very beginning (bottom z-order)
        // This ensures it's drawn first and other elements appear on top
        if (!cq.correctAnswers || cq.correctAnswers.length < 1) {return this.svg;}
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
        let p = this.getCurrentPlayer();
        cq.answers.forEach((answer, index) => {
            let coords = this.parseCoordinates(answer.answer);
            const x = coords[0];
            const y = coords[1];
            // Select a color based on the index, cycling through the colors array
            const colorIndex = index % ClickMap.colors.length;
            const color = ClickMap.colors[colorIndex];
            // don't draw the answer for the current player
            // it has already been drawn by getContent
            if (answer.username !== p.username) {
                let tm = this.drawMarker(x, y, color, answer.username);
            }
        });
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
        if (!this.svg) return;
        if (!x || !y || !colour) return;
        if (isNaN(x) || isNaN(y)) return;

        this.info(`Drawing marker at ${x}, ${y} with color ${colour}`);

        // Log the current viewBox values
        const box = this.svg.viewBox.baseVal;
        this.info(`Current viewBox: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        if (id) {
            circle.setAttribute("id", id);
        }

        // Store coordinates
        this.answerx = x;
        this.answery = y;

        // Set radius and styles
        const zoomAdjustedRadius = this.markerSize / this.scale;
        this.info(`Marker radius: ${zoomAdjustedRadius} (markerSize: ${this.markerSize}, scale: ${this.scale})`);

        circle.setAttribute("r", zoomAdjustedRadius);
        circle.setAttribute("fill", colour);
        circle.setAttribute("opacity", "0.8");
        circle.setAttribute("stroke", "#FFFFFF");
        circle.setAttribute("stroke-width", "1");

        // Store reference and append
        this.currentMarker = circle;
        this.svg.appendChild(circle);

        // Log the SVG dimensions
        const svgRect = this.svg.getBoundingClientRect();
        this.info(`SVG dimensions: width=${svgRect.width}, height=${svgRect.height}`);

        return circle;
    }

    /* Add method to create/update marker when user clicks
    */
    addMarker(x, y, colour, id) {
        if (!this.svg) return;

        // If an id is provided and starts with the marker prefix,
        // remove any existing marker with that prefix
        if (id && id.startsWith(ClickMap.markerIdPrefix)) {
            const existingMarkers = this.svg.querySelectorAll(`circle[id^="${ClickMap.markerIdPrefix}"]`);
            existingMarkers.forEach(marker => marker.remove());
        }

        const svgRect = this.svg.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) {
            this.warn('SVG has invalid dimensions');
            return;
        }

        const box = this.svg.viewBox.baseVal;

        // Calculate the scale factors between screen and SVG space
        const scaleX = box.width / svgRect.width;
        const scaleY = box.height / svgRect.height;

        // Convert screen coordinates to SVG viewBox coordinates
        const svgX = (x - svgRect.left) * scaleX + box.x;
        const svgY = (y - svgRect.top) * scaleY + box.y;

        return this.drawMarker(svgX, svgY, colour, id);
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
                    //only allow marker placing if the question is active
                    if (!this.isQuestionActive()) return;
                    this.isDragging = false;
                    container.style.cursor = 'default';
                    //let x = this.parseCoordinate(dx)
                    //let y = this.parseCoordinate(dy)
                    let x = tx;
                    let y = ty;
                    this.addMarker(x, y, "#000000", ClickMap.markerIdPrefix);
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