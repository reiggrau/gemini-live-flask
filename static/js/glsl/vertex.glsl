// For coding only. particles.js uses a string literal copy

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
}