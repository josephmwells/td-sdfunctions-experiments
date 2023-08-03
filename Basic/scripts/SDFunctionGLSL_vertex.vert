// Example Vertex Shader

out Vertex
{
	vec4 color;
	vec3 worldSpacePos;
	vec3 worldSpaceNorm;
	vec2 texCoord0;
	flat int cameraIndex;
	vec4 camSpaceVert;
	vec4 worldSpaceVert;
	vec3 objectSpaceVert;
} outVertex;

out vec3 fragPosition;

void main() 
{
	gl_PointSize = 1.0;
	{ // Avoid duplicate variable defs
		vec3 texcoord = TDInstanceTexCoord(uv[0]);
		outVertex.texCoord0.st = texcoord.st;
	}
	// First deform the vertex and normal
	// TDDeform always returns values in world space
	vec4 worldSpacePos = TDDeform(P);
	fragPosition = (uTDMats[TDCameraIndex()].world * vec4(P, 1.0)).xyz;

	gl_Position = TDWorldToProj(worldSpacePos);

#ifndef TD_PICKING_ACTIVE
	int cameraIndex = TDCameraIndex();
 	outVertex.cameraIndex = cameraIndex;
 	
	outVertex.worldSpacePos.xyz = worldSpacePos.xyz;
	outVertex.color = TDInstanceColor(TDPointColor());
	
	vec3 worldSpaceNorm = normalize(TDDeformNorm(N));
 	outVertex.worldSpaceNorm.xyz = worldSpaceNorm;
	
	outVertex.camSpaceVert = uTDMats[TDCameraIndex()].world * uTDMats[TDCameraIndex()].cam * vec4(P, 1.0);
	
	outVertex.worldSpaceVert = uTDMats[TDCameraIndex()].world * vec4(P, 1.0);
	
	outVertex.objectSpaceVert = P;

#else // TD_PICKING_ACTIVE
	// This will automatically write out the nessessary values
	// for this shader to work with picking.
	// See the documentation if you want to write custom values for picking.
	TDWritePickingValues();
#endif // TD_PICKING_ACTIVE
}

