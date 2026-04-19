console.log('particles.js loaded');

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BASE_SIZE = 3.0; // Base size of stars
const TWINKLE_SPEED = 2.0; // Speed of twinkle animation

const vertexShader = getVertexShader();
const fragmentShader = getFragmentShader();

// 1. Get the container & dimensions
const container = document.getElementById('particles-container');
const width = container.clientWidth;
const height = container.clientHeight;

// 2. Create the scene, camera, and renderer
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

// 3. Add an axes helper & OrbitControls for debugging
// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 4. Create the star particle system
// 4a. Load star data from the binary file
const response = await fetch('/static/star-data/stars.bin');
const buffer = await response.arrayBuffer();
const starData = new Float32Array(buffer);

// 4b. Process the star data into positions, sizes, and colors
const count = starData.length / 5; // Each star has x, y, z, magnitude, kelvin

// Find magnitude range for size mapping (data is sorted: brightest first)
const minMag = starData[3]; // Brightest star (e.g. -1.46)
const maxMag = starData[(count - 1) * 5 + 3]; // Faintest star (e.g. ~6.5)

const positions = new Float32Array(count * 3); // x, y, z
const properties = new Float32Array(count * 3); // visual size, animation phase, placeholder
const colors = new Float32Array(count * 3); // r, g, b

for (let i = 0; i < count; i++) {
	const si = i * 5; // Star data index

	positions[i * 3] = starData[si]; // x
	positions[i * 3 + 1] = starData[si + 1]; // y
	positions[i * 3 + 2] = starData[si + 2]; // z

	properties[i * 3] = magnitudeToSize(starData[si + 3], minMag, maxMag); // visual size (0.0 to 1.0)
	properties[i * 3 + 1] = Math.random() * 2 * Math.PI; // animation phase (0 to 2π)
	properties[i * 3 + 2] = 0;

	const [r, g, b] = kelvinToRGB(starData[i * 5 + 4]);
	colors[i * 3] = r;
	colors[i * 3 + 1] = g;
	colors[i * 3 + 2] = b;
}

// 4c. Create the geometry and material for the stars
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('aProperties', new THREE.BufferAttribute(properties, 3));

const material = new THREE.ShaderMaterial({
	uniforms: {
		uTime: { value: 0 },
		uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, // For scaling star sizes on high-DPI screens
		uBaseSize: { value: BASE_SIZE },
		uTwinkleSpeed: { value: TWINKLE_SPEED },
	},
	vertexShader,
	fragmentShader,
	transparent: true,
	depthWrite: false,
	depthTest: true,
	blending: THREE.AdditiveBlending,
});

// 4d. Create the stars and add to the scene
const stars = new THREE.Points(geometry, material);
scene.add(stars);

function animate(time) {
	controls.update();
	material.uniforms.uTime.value = time * 0.001; // milliseconds
	// stars.rotation.y = time * 0.000002; // Slow rotation for a dynamic views
	renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// FUNCTIONS
// Convert magnitude to a 0–1 visual size (brighter = larger)
// Magnitude is inverted & logarithmic: -1.46 (Sirius) is brightest, 6.5 is barely visible
// Since magnitude is already a log scale, a linear map produces perceptually even sizes
function magnitudeToSize(mag, minMag, maxMag) {
	return (maxMag - mag) / (maxMag - minMag); // 1.0 for brightest, 0.0 for faintest
}

// Convert star temperature to RGB (Tanner Helland's algorithm)
// Cool stars → red/orange, mid stars → white/yellow, hot stars → blue/white
function kelvinToRGB(kelvin) {
	const t = Math.min(Math.max(kelvin, 1000), 40000) / 100;
	let r, g, b;

	if (t <= 66) {
		r = 1;
		g = Math.min(Math.max((99.4708 * Math.log(t) - 161.1196) / 255, 0), 1);
		b =
			t <= 19
				? 0
				: Math.min(
						Math.max((138.5177 * Math.log(t - 10) - 305.0448) / 255, 0),
						1,
					);
	} else {
		r = Math.min(Math.max((329.6987 * Math.pow(t - 60, -0.1332)) / 255, 0), 1);
		g = Math.min(Math.max((288.1222 * Math.pow(t - 60, -0.0755)) / 255, 0), 1);
		b = 1;
	}

	return [r, g, b];
}

// SHADERS
function getVertexShader() {
	return `
attribute vec3 aProperties;
attribute vec3 aColor;

uniform float uTime;
uniform float uPixelRatio;
uniform float uBaseSize;
uniform float uTwinkleSpeed;

varying float vRadius;
varying float vTwinkle;
varying float vAlphaScale;
varying vec3 vColor;

void main() {
  // 1. Compute the particle's position
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;

  gl_Position = projectionMatrix * viewPosition;

  // 2. Compute particle size with twinkle effect
  float size = aProperties.x;
  float phase = aProperties.y; // (0 to 2π)

  float twinkle = 0.85 + 0.15 * sin(uTime * uTwinkleSpeed + phase);
  float pointSize = size * uBaseSize * twinkle * uPixelRatio;

  // Prevent sub-pixel flickering: keep min 1px, fade alpha for small stars
  vAlphaScale = min(pointSize, 1.0); // 1.0 for normal stars, <1.0 for sub-pixel
  gl_PointSize = max(pointSize, 1.0);

  // 3. Pass to fragment shader
  vRadius = pointSize * 0.5;
  vTwinkle = twinkle;
  vColor = aColor;
}`;
}

function getFragmentShader() {
	return `
varying float vRadius;
varying float vTwinkle;
varying float vAlphaScale;
varying vec3 vColor;

void main() {
  // 1. Star shape
  // Compute UV coordinates relative to the center of the point
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);

  if (dist > 0.5) discard; // Discard fragments outside the circle

  // core, disc, and halo components for the star's appearance
  float core = exp(-36.0 * dist * dist);
	float disc = smoothstep(0.5, 0.12, dist);
	float halo = smoothstep(0.5, 0.0, dist) * 0.22;

  // Combine core and disc, add halo on top
  float alpha = max(core, disc * 0.35) + halo;
  alpha *= vAlphaScale; // Fade sub-pixel stars instead of flickering

  // 2. Star color modulated by twinkle effect
  vec3 starColor = vColor * (0.9 + 0.1 * vTwinkle);

  // 3. Size-based glow
  float sizeGlow = smoothstep(0.0, 4.0, vRadius);
  starColor *= mix(0.9, 1.12, sizeGlow);

  gl_FragColor = vec4(starColor, alpha);
}`;
}
