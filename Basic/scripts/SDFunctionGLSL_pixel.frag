// Example Pixel Shader

#define dNUM_SPHERES 20

// Animation Uniforms
uniform float uTIME;
uniform float uTIMESCALE;
uniform float uSMOOTH_K;

// Shape Uniforms
uniform float uNUM_SPHERES;
// uniform vec4[uNUM_SPHERES] aSPHERES;
uniform sampler2D sSPHERES;

// Ray Marching Uniforms
uniform int uMAX_STEPS;
uniform float uMAX_DIST;
uniform float uSURFACE_DIST;

// input structures
in Vertex
{
	vec4 color;
	vec3 worldSpacePos;
	vec3 worldSpaceNorm;
	vec2 texCoord0;
	flat int cameraIndex;
	vec4 camSpaceVert;
	vec4 worldSpaceVert;
	vec3 objectSpaceVert;
} inVertex;

in vec3 fragPosition;

// output structures
out vec4 fragColor;
out float fragDepth;



// Shape Functions

float SDFunc_Sphere(vec3 ray_position, vec3 sphere_position, float sphere_radius) {
	return length(sphere_position - ray_position) - sphere_radius;
}

float SDFunc_RoundBox(vec3 ray_position, vec3 box_position, vec3 box_bounds, float radius)
{
  vec3 q = abs(box_position - ray_position) - box_bounds;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - radius;
}

// Combination/Boolean Functions

float Union(float dist1, float dist2) {
	return min(dist1, dist2);
}

float Subtraction(float dist1, float dist2) {
	return max(-dist1, dist2);
}

float Intersection(float dist1, float dist2) {
	return max(dist1, dist2);
}

// Smooth Combination Functions

// polynomial smooth min

float smin( float a, float b, float k )
{
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*k*(1.0/4.0);
}

float Smooth_Union(float dist1, float dist2, float k) {
	return smin(dist1, dist2, k);
}

float Smooth_Subtraction(float dist1, float dist2, float k) {
    float h = clamp( 0.5 - 0.5*(dist2+dist1)/k, 0.0, 1.0 );
    return mix( dist2, -dist1, h ) + k*h*(1.0-h);
}

float Smooth_Intersection(float dist1, float dist2, float k) {
    float h = clamp( 0.5 - 0.5*(dist2-dist1)/k, 0.0, 1.0 );
    return mix( dist2, dist1, h ) + k*h*(1.0-h);
}

// Marching Functions

float Get_Distance(vec3 position) {
	float time = uTIME * uTIMESCALE;

	// *** test marching and sdfunctions *** //
	/*
	float sphere1 = SDFunc_Sphere(position, vec3 (-0.1, sin(time * 0.98), 0.), .25);
	float sphere2 = SDFunc_Sphere(position, vec3 (0.2, sin(time * 1.02 + 11), 0.1), .25);
	
	float sphere3 = SDFunc_Sphere(position, vec3 (-0.15, sin(time * 1 + 22), -0.1), .25);
	float sphere4 = SDFunc_Sphere(position, vec3 (0.1, sin(time * 0.96 + 33), 0.0), .25);

	float k = uSMOOTH_K;

	float sphere_combination0 = sphere1;
	float sphere_combination1 = Smooth_Union(sphere2, sphere_combination0, k);
	float sphere_combination2 = Smooth_Union(sphere3, sphere_combination1, k);
	float sphere_combination3 = Smooth_Union(sphere4, sphere_combination2, k);

	float distance = sphere_combination3;
	*/

	// *** dynamic sphere generation *** //
	// Loop through the sSPHERES samplers to get the x,y,z components for position
	// and the w component for radius
	// default to Smooth_Union for combining multiple SDFs

	ivec2 TEXTURE_SIZE = textureSize(sSPHERES, 0);
	float k = uSMOOTH_K;
	float shape_combination = uMAX_DIST - 1.;

	float num_spheres = dNUM_SPHERES;
	float lookup_offset_x = (1. / num_spheres) / 2.;
	
	for (int i = 0; i < num_spheres; ++i) {
		vec2 lookup_index = vec2((float(i) / num_spheres) + lookup_offset_x, 0.5);
		vec4 lookup = texture(sSPHERES, lookup_index);
		float new_shape = SDFunc_RoundBox(position, lookup.xyz, vec3(lookup.w), abs(sin(time)) * 0.2 + 0.05);
		
		// set the 0th combination to just be the first new sphere
		if (i == 0) shape_combination = new_shape;
		shape_combination = Smooth_Union(new_shape, shape_combination, k);
	}
	
	////float round_box1 = SDFunc_RoundBox(position, vec3(0.2, 0., 0.), vec3(0.1, 0.1, 0.1), 0.1);
	// float distance = round_box1;
	
	float distance = shape_combination;

	// float distance = SDFunc_Sphere(position, vec3(0.0, 0.0, 0.0), .5);
	return distance;
}

vec3 Get_Normal(vec3 position) {
	float distance = Get_Distance(position);
	// epsilon defines the distance around the position to sample
	vec2 epsilon = vec2(0.01, 0.0);
	vec3 normal = distance - vec3(
		Get_Distance(position - epsilon.xyy),
		Get_Distance(position - epsilon.yxy),
		Get_Distance(position - epsilon.yyx)
	);

	return normalize(normal);
}

float Ray_March(vec3 ray_origin, vec3 ray_direction) {
	float distance = 0.0;
	for (int i = 0; i < uMAX_STEPS; i++) {
		vec3 position = ray_origin + ray_direction * distance;
		float distance_step = Get_Distance(position);
		distance += distance_step;

		if (distance > uMAX_DIST || distance_step < uSURFACE_DIST) break;
	}

	return distance;
}

void main()
{
	// TDCheckDiscard();

	vec3 ray_direction_local = normalize(inVertex.objectSpaceVert);
	//vec3 ray_direction_world = transpose(uTDMats[inVertex.cameraIndex].worldInverse);

	// transform the view/camera space vertex position back to world space
	// vec3 world_frag_pos = (uTDMats[inVertex.cameraIndex].camInverse * inVertex.camSpaceVert).xyz;
	//vec3 world_frag_pos = (uTDMats[inVertex.cameraIndex].camInverse * inVertex.camSpaceVert).xyz;

	vec3 world_frag_pos = fragPosition;

	// since in view space the camera is the origin vector (0, 0, 0), 
	// we can use the camera inverse matrix to transform the origin to world space
	vec3 ray_origin = (uTDMats[inVertex.cameraIndex].camInverse * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

	// add the world position of the vertex as an offset to the ray origin
	// this will offset how the SDF is finally rendered in the scene,
	// effectively keeping the boudning cube as its origin
	ray_origin = ray_origin + world_frag_pos;
	
	vec3 ray_direction = normalize(world_frag_pos - ray_origin);

	float ray_distance = Ray_March(ray_origin, ray_direction);
	
	// *** set color *** //
	
	// get alpha as a check against ray_distance and the max distance a ray is allowed to travel 
	// before it is discarded or considered a miss
	float alpha = step(ray_distance, uMAX_DIST);

	// get albedo color
	vec3 albedo = Get_Normal(ray_origin + ray_direction * ray_distance);
	
	vec4 color = vec4(albedo, alpha);

	// *** set depth *** //
	// transform the point from world to clip/projection space (using the MVP Matrix)
	vec3 world_space_position = ray_origin + ray_direction * ray_distance;
	vec4 clip_space_position = uTDMats[inVertex.cameraIndex].camProj * vec4(world_space_position, 1.0);

	// perform perspective division and bring the point from clip space to NDC space
	// with the z component giving us the depth in NDC space
	vec3 ndc_space_position = clip_space_position.xyz / clip_space_position.w;

	// normalize z value from NDC space -1 to 1 to depth space 0 to 1
	float depth = ndc_space_position.z;

	// test output to depth color buffer to confirm
	// vec4 depthColor = vec4(vec3(depth), alpha);

	fragColor = TDOutputSwizzle(color);
	gl_FragDepth = depth;
	// TODO: Figure out why the Touchdesigner `out float fragDepth` buffer isn't working
	// ex:
	// out float fragDepth
	// ...
	// fragDepth = customDepth;
}

