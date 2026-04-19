// For coding only. particles.js uses a string literal copy

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
}

