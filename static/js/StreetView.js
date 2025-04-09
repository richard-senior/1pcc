/**
 * PageElement that manages the displaying of google streetview for
 * geolocation questions
 */
class StreetView extends PageElement {
    constructor() {
        super('streetview-container', ['geolocation']);
        this.baseUrl = "https://www.google.com/maps/embed?pb=";
        this.container = null;
        this.iframe = null;
        this.url = null;
    }

    /** just speed things up a little */
    createStyles() {}

    shouldUpdate() {
        // if we haven't been instantiated properly yet
        if (!this.url) {return true;}
        // if we have relevant data for this kind of question
        let cq = this.getCurrentQuestion()
        if (!cq || !cq.streetView) {return false;}
        // if we've started a different question
        if (cq.streetView !== this.url) {return true;}
        return false;
    }

    getContent(gs) {
        let cq = this.getCurrentQuestion();
        this.url = cq.streetView;
        const embedUrl = this.baseUrl + this.url;
        this.container = this.getElement();
        // Set container to relative positioning
        this.container.style.position = 'relative';
        // Create and setup iframe with required permissions
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'streetview-iframe'
        this.iframe.class = 'streetview-iframe'
        this.iframe.src = embedUrl;
        this.iframe.allow = "autoplay; picture-in-picture;";
        this.iframe.sandbox = "allow-scripts allow-same-origin";
        this.iframe.allowfullscreen="false"
        this.iframe.loading="lazy"
        this.iframe.referrerpolicy="no-referrer-when-downgrade"
        // Create the semi-transparent blur overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '45vw';
        overlay.style.height = '10vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
        overlay.style.backdropFilter = 'blur(5px)'; // Add blur effect
        overlay.style.webkitBackdropFilter = 'blur(5px)'; // For Safari support
        overlay.style.zIndex = '1000';
        overlay.style.borderRadius = '4px'; // Optional: rounded corners

        // Clear container and add both elements
        this.container.innerHTML = '';
        this.container.appendChild(this.iframe);
        this.container.appendChild(overlay);
    }
}