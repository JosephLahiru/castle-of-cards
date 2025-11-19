// assets.js

window.Images = {}; // Global object to store loaded images

const loadImage = (name, src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`Image loaded successfully: ${name} from ${src}`); // Added log
            window.Images[name] = img;
            resolve();
        };
        img.onerror = (e) => {
            console.error(`Failed to load image: ${name} from ${src}`, e);
            reject(new Error(`Failed to load image: ${name}`));
        };
        //console.log(`Attempting to load image: ${name} from path: ${src}`); // Added log
        img.src = src; // This is now a file path, not a data URI
    });
};

// Now, list your image file paths relative to your index.html
// Make sure the paths are correct based on your folder structure.
window.imagePromises = [
    // Towers
    loadImage('tower_base', 'src/tower_base.png'),
    loadImage('archer_turret', 'src/archer_turret.png'),
    loadImage('archer_projectile', 'src/archer_projectile.png'),
    loadImage('cannon_turret', 'src/cannon_turret.png'),
    loadImage('cannon_projectile', 'src/cannon_projectile.png'),
    loadImage('ice_turret', 'src/ice_turret.png'),
    loadImage('ice_projectile', 'src/ice_projectile.png'),
    loadImage('castle', 'src/castle.png'),
    
    // Control Button Images
    loadImage('control_archer', 'src/control_archer.png'),
    loadImage('control_cannon', 'src/control_cannon.png'),
    loadImage('control_ice', 'src/control_ice.png')
];