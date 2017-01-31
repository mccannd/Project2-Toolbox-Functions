
// Skybox texture from: https://github.com/mrdoob/three.js/tree/master/examples/textures/cube/skybox

const THREE = require('three'); // older modules are imported like this. You shouldn't have to worry about this much
import Framework from './framework'

// wing control parameters
var settings = {
  numEdge: 20,
  numCols: 15,
  numRows: 4,
  noiseScale: 4.0,
  noiseIntensity: 1.0,
  noiseFrequency: 1.0,
  cullThreshold: -0.25,
  flapRange: Math.PI / 4.0,
  flapSpeed: 1.0,
  curveBias: 0.1,
  color: [0, 128, 255]
};

var endPt = new THREE.Vector3(5.0, 0, 1.5);

var curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3( 0, 0, 0 ),
    new THREE.Vector3( 2, 0, -0.1 ),
    new THREE.Vector3(endPt.x - 0.5, 0, endPt.z - 1.0),
    endPt
);

var curve2 = new THREE.CubicBezierCurve3(
    new THREE.Vector3( 0, 0, endPt.z ),
    new THREE.Vector3( 2, 0, endPt.z + 0.5 ),
    new THREE.Vector3(endPt.x - 1, 0, endPt.z - 0.5),
    endPt
);

// gradients for improved perlin noise
var gradients = [new THREE.Vector2(1.0, 0), new THREE.Vector2(-1.0, 0),
      new THREE.Vector2(0, 1.0), new THREE.Vector2(0, -1.0),
      new THREE.Vector2(0.7071, 0.7071), new THREE.Vector2(-0.7071, 0.7071),
      new THREE.Vector2(0.7071, -0.7071), new THREE.Vector2(-0.7071, -0.7071)];

// hash table for improved perlin noise
var pHash = [151,160,137,91,90,15,
   131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
   190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
   88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
   77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
   102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
   135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
   5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
   223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
   129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
   251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
   49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
   138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];


function lerp(a, b, t) {
    return (t * b + (1.0 - t) * a);
}

function bias(b, t) {
    return Math.pow(t, Math.log(b) / Math.log(0.5));
}

function gain(g, t) {
    if (t < 0.5) {
        return bias(1 - g, 2 * t) / 2;
    } else {
        return 1 - bias(1 - g, 2 - 2 * t) / 2;
    }
}


// currently unused
function bezier(c1, c2, c3, c4, t) {
    var c12 = c1.lerp(c2, t);
    var c23 = c2.lerp(c3, t);
    var c34 = c3.lerp(c4, t);

    var c1223 = c12.lerp(c23, t);
    var c2334 = c23.lerp(c34, t);

    return c1223.lerp(c2334, t);
}

//2D perlin noise
function getNoise(u, v) {
    var xs = u * settings.noiseScale;
    var ys = v * settings.noiseScale;

    var xlb = Math.floor(xs);
    var ylb = Math.floor(ys);

    var i = pHash[pHash[xlb + pHash[ylb]]] / 256.0;
    var g = gradients[Math.floor(i * 8.0)];
    var p = new THREE.Vector2(xs - xlb, ys - ylb);
    var dll = g.dot(p);

    i = pHash[pHash[xlb + 1 + pHash[ylb]]] / 256.0;
    g = gradients[Math.floor(i * 8.0)];
    p = new THREE.Vector2(xs - xlb - 1.0, ys - ylb);
    var dlr = g.dot(p);

    i = pHash[pHash[xlb + pHash[ylb + 1]]] / 256.0;
    g = gradients[Math.floor(i * 8.0)];
    p = new THREE.Vector2(xs - xlb, ys - ylb - 1.0);
    var dul = g.dot(p);


    i = pHash[pHash[xlb + 1 + pHash[ylb + 1]]] / 256.0;
    g = gradients[Math.floor(i * 8.0)];
    p = new THREE.Vector2(xs - xlb - 1.0, ys - ylb - 1.0);
    var dur = g.dot(p);


    return lerp(lerp(dll, dlr, xs - xlb), lerp(dul, dur, xs - xlb), ys - ylb);
}

// function that ENTIRELY deletes and reloads the wing
// yes, this is quite inefficient
function loadWing(framework) {
    var scene = framework.scene;
    var camera = framework.camera;
    var renderer = framework.renderer;
    var gui = framework.gui;
    var stats = framework.stats;

    var wing = framework.scene.getObjectByName("wing"); 
    if (wing !== undefined) {
        scene.remove(wing);
    }
    // basic shader
    var lambertWhite = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide });

    var geom = new THREE.Geometry();
    geom.vertices = curve.getPoints(settings.numEdge);

    // load the feather
    var objLoader = new THREE.OBJLoader();
    objLoader.load('geo/feather.obj', function(obj) {

        // LOOK: This function runs after the obj has finished loading
        var featherGeo = obj.children[0].geometry;

        var featherMesh = new THREE.Mesh(featherGeo, lambertWhite);
        var wingGroup = new THREE.Group();
        wingGroup.name = "wing";

        // make all feathers along the edge of the wing
        for (var i = 0; i < settings.numEdge; i++) {
            var t = i / (1.0 * settings.numEdge - 1.0);
            var copyGeo = new THREE.Mesh(featherGeo, lambertWhite);
            copyGeo.position.copy(geom.vertices[i]);


            var rotY = (1.0 - t * t * t) * Math.PI / 1.8;
            var rotX = Math.PI / 9.0;
            var rotZ = -Math.PI / 18.0;
            var u = copyGeo.position.x / endPt.x;
            var v = (copyGeo.position.y + 0.1) / (endPt.z + 0.1);

            copyGeo.rotateY(rotY);
            copyGeo.rotateX(Math.PI / 9.0);
            copyGeo.scale.set(0.7 + 0.5 * t*t*t, 1, 1);
            copyGeo.name = "tipFeather " + i; 
            copyGeo.userData = {xR: rotX, yR: rotY, zR: rotZ, u: u, v: v};
            wingGroup.add(copyGeo);
        }


        // make the rest of the feathers
        for (var y = 0; y < settings.numRows; y++) {
            for (var x = 0; x < settings.numCols; x++) {
                var cPos = curve.getPointAt(x / (1.0 * settings.numCols) - ((y % 2 == 0) ? 0.0 : 0.05));
                var cPos2 = curve2.getPointAt(x / (1.0 * settings.numCols) - ((y % 2 == 0) ? 0.0 : 0.05));
                var xPos = lerp(cPos.x, cPos2.x, (y + 1.0)/ (settings.numRows + 1.0));
                var zPos = lerp(cPos.z, cPos2.z, (y + 1.0)/ (settings.numRows + 1.0));

                var t = x / (1.0 * settings.numCols);
                var rotX = Math.PI / 9.0;
                var rotY = (1.0 - t * t * t) * Math.PI / 2.0;
                var rotZ = 0;//Math.PI / 18.0;
                var u = xPos / endPt.x;
                var v = (zPos + 0.1) / (endPt.z + 0.5);

                var n = getNoise(u, v);
                
                // if the noise is below the threshold, the feather will not appear
                if (n > settings.cullThreshold) {
                    var copyGeo = new THREE.Mesh(featherGeo, lambertWhite);
                    copyGeo.position.set(xPos, 0, zPos);
                    copyGeo.scale.set(0.5 * 4.0 / settings.numRows, 1, 2);
                    //rotateFeather(x, y, copyGeo);
                    copyGeo.rotateY(rotY);
                    copyGeo.rotateX(rotX);
                    copyGeo.rotateZ(rotZ);
                
                    copyGeo.userData = {xR: rotX, yR: rotY, zR: rotZ, u: u, v: v};
                    copyGeo.name = "gridFeather " + (y * 10 + x); 
                    wingGroup.add(copyGeo);
                }
            }
        }
        scene.add(wingGroup);

    });
}

// called after the scene loads
function onLoad(framework) {
    var scene = framework.scene;
    var camera = framework.camera;
    var renderer = framework.renderer;
    var gui = framework.gui;
    var stats = framework.stats;

    // Basic Lambert white
    var lambertWhite = new THREE.MeshLambertMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide });

    // Set light
    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionalLight.color.setHSL(0.1, 1, 0.95);
    directionalLight.position.set(1, 3, 2);
    directionalLight.position.multiplyScalar(10);

    // set skybox
    var loader = new THREE.CubeTextureLoader();
    var urlPrefix = 'images/skymap/';

    var skymap = new THREE.CubeTextureLoader().load([
        urlPrefix + 'px.jpg', urlPrefix + 'nx.jpg',
        urlPrefix + 'py.jpg', urlPrefix + 'ny.jpg',
        urlPrefix + 'pz.jpg', urlPrefix + 'nz.jpg'
    ] );

    scene.background = skymap;

    // create the wing
    loadWing(framework);

    // set camera position
    camera.position.set(0, 1, 5);
    camera.lookAt(new THREE.Vector3(0,0,0));

    // scene.add(lambertCube);
    scene.add(directionalLight);

    // edit params and listen to changes like this
    // more information here: https://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage
    gui.add(camera, 'fov', 0, 180).onChange(function(newVal) {
        camera.updateProjectionMatrix();
    });


    // add all gui options
    // NOTE: I'm aware that recreating the whole wing is extremely inelegant.
    // will likely change in the future, but not by the original submission
    gui.add(settings, 'noiseScale', 2.0, 16.0);
    gui.add(settings, 'noiseIntensity', 0.0, 10.0);
    gui.add(settings, 'noiseFrequency', 0.0, 3.0);
    gui.add(settings, 'cullThreshold', { None: -1.0, Low: -0.3, 
        Med: -0.2, High: -0.1, Half: 0.0 } ).onChange(function(newVal) {
        loadWing(framework);
    });
    gui.add(settings, 'flapRange', 0.0, Math.PI / 3.0);
    gui.add(settings, 'flapSpeed', 0.1, 3.0);
    gui.addColor(settings, 'color');
    gui.add(settings, 'numCols', 10, 20).onChange(function(newVal) {
        loadWing(framework);
    });
    gui.add(settings, 'numRows', 2, 6).onChange(function(newVal) {
        loadWing(framework);
    });
    gui.add(settings, 'curveBias', 0.1, 0.5);
}

// called on frame updates
function onUpdate(framework) {
    var wing = framework.scene.getObjectByName("wing");    
    if (wing !== undefined) {
        // Simply flap wing
        var date = new Date();
        var wRot = Math.sin(settings.flapSpeed * date.getTime() / 500) * settings.flapRange;
        wing.rotation.set(0, -0.25 * wRot, 0.5 * wRot);

        var allFeathers = wing.children; 
        for (var i = 0; i < allFeathers.length; i++) {
            var f = allFeathers[i];
            var noise = getNoise(f.userData.u, f.userData.v);
            
            // rotation:
            // x stays the same
            // y and z affected by noise
            // z is affected by local y rot, adding wing curvature
            f.rotation.set(f.userData.xR,
            f.userData.yR + (0.035 * settings.noiseIntensity * 
                Math.sin(Math.PI * noise + settings.noiseFrequency * date.getTime() / 250)),
            f.userData.zR + (0.03 * settings.noiseIntensity * 
                Math.sin(Math.PI * noise + settings.noiseFrequency * date.getTime() / 100)) + 
            (1.0 - f.userData.yR / (Math.PI / 2.0)) * wRot * 1.5);

            f.material.color.setRGB(settings.color[0] / 255.0, settings.color[1] / 255.0, settings.color[2] / 255.0);
            // curvature of the wing is quadratic and based on horizontal position

            var t = f.position.x / endPt.x;
            t = bias(t, settings.curveBias);

            f.position.set(f.position.x, t * endPt.x * wRot, f.position.z);
        }   
    }
}

// when the scene is done initializing, it will call onLoad, then on frame updates, call onUpdate
Framework.init(onLoad, onUpdate);