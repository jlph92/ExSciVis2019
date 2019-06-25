#version 150
//#extension GL_ARB_shading_language_420pack : require
#extension GL_ARB_explicit_attrib_location : require

#define TASK 10
#define ENABLE_OPACITY_CORRECTION 0
#define ENABLE_LIGHTNING 0
#define ENABLE_SHADOWING 0

in vec3 ray_entry_position;

layout(location = 0) out vec4 FragColor;

uniform mat4 Modelview;

uniform sampler3D volume_texture;
uniform sampler2D transfer_texture;


uniform vec3    camera_location;
uniform float   sampling_distance;
uniform float   sampling_distance_ref;
uniform float   iso_value;
uniform vec3    max_bounds;
uniform ivec3   volume_dimensions;

uniform vec3    light_position;
uniform vec3    light_ambient_color;
uniform vec3    light_diffuse_color;
uniform vec3    light_specular_color;
uniform float   light_ref_coef;


bool
inside_volume_bounds(const in vec3 sampling_position)
{
    return (   all(greaterThanEqual(sampling_position, vec3(0.0)))
            && all(lessThanEqual(sampling_position, max_bounds)));
}


float
get_sample_data(vec3 in_sampling_pos)
{
    vec3 obj_to_tex = vec3(1.0) / max_bounds;
    return texture(volume_texture, in_sampling_pos * obj_to_tex).r;

}

vec3
get_gradient(vec3 pos)
{
    vec3 dim= max_bounds/volume_dimensions;
    vec3 dimX= vec3(dim.x,0.0,0.0);
    vec3 dimY= vec3(0.0,dim.y,0.0);
    vec3 dimZ= vec3(0.0,0.0,dim.z);

   float gradientX= (get_sample_data(pos+dimX)-get_sample_data(pos-dimX))/2;
   float gradientY= (get_sample_data(pos+dimY)-get_sample_data(pos-dimY))/2;
   float gradientZ= (get_sample_data(pos+dimZ)-get_sample_data(pos-dimZ))/2;

   return normalize(vec3(gradientX,gradientY,gradientZ));

}

vec3
phong_shading(vec3 pos, vec4 dst){
    vec3 Norm = get_gradient(pos);
    vec3 light =  normalize(light_position-pos);
    float dot = max(0, Norm.x*light.x+Norm.y*light.y+Norm.z*light.z);

    vec3 k =  light_diffuse_color*dot;
   
    return  vec3( k.x*dst.x, k.y*dst.y, k.z*dst.z);
}

bool
shading(vec3 sampling_pos){
    vec3 light = normalize(sampling_pos-light_position);

    bool increase = false;
    bool decrease = false;

    vec3 ray_increment = light * sampling_distance;

    sampling_pos += ray_increment;

    bool inside_volume = inside_volume_bounds(sampling_pos);
    
    if (!inside_volume)
        discard;

     while (inside_volume)
    {
        // get sample
        float s = get_sample_data(sampling_pos);
        if (s > iso_value)
            increase = true;
        //if (s < iso_value)
        //    decrease  = true;

        //if( increase && decrease) return true;
        if( increase) return true;
        // increment the ray sampling position
        sampling_pos += ray_increment;

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
    return false;
}


void main()
{
    /// One step trough the volume
    vec3 ray_increment      = normalize(ray_entry_position - camera_location) * sampling_distance;
    /// Position in Volume
    vec3 sampling_pos       = ray_entry_position + ray_increment; // test, increment just to be sure we are in the volume

    /// Init color of fragment
    vec4 dst = vec4(0.0, 0.0, 0.0, 0.0);

    /// check if we are inside volume
    bool inside_volume = inside_volume_bounds(sampling_pos);
    
    if (!inside_volume)
        discard;

#if TASK == 10
    vec4 max_val = vec4(0.0, 0.0, 0.0, 0.0);
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume) 
    {      
        // get sample
        float s = get_sample_data(sampling_pos);
                
        // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));
           
        // this is the example for maximum intensity projection
        max_val.r = max(color.r, max_val.r);
        max_val.g = max(color.g, max_val.g);
        max_val.b = max(color.b, max_val.b);
        max_val.a = max(color.a, max_val.a);
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    dst = max_val;
#endif 
    
#if TASK == 11
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    float samples = 0;
    while (inside_volume)
    {      
        // get sample
        float s = get_sample_data(sampling_pos);

        samples+=1.0;

        // dummy code
        dst += texture(transfer_texture, vec2(s, s));
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    if (samples > 0.0) {
      dst /= samples;
    }
#endif
    
#if TASK == 12 || TASK == 13
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
        // get sample
        float s = get_sample_data(sampling_pos);

        if (s > iso_value) {
          //dst = texture(transfer_texture, vec2(s, s));         
        
        #if TASK == 13 // Binary Search

         //Binary Search

             vec3 low= sampling_pos-ray_increment;
             vec3 upper= sampling_pos;
             vec3 mid_point;

             for(int i=0;i<64; i++){

             mid_point = (low+upper)*0.5;

             float s = get_sample_data(mid_point);

             if(s==iso_value) break;

             if(s<iso_value) low=mid_point;

             if(s>iso_value) upper=mid_point;

             sampling_pos = mid_point;

             } 

             s = get_sample_data(mid_point);  
        #endif

            dst = texture(transfer_texture, vec2(s, s));

  

#if ENABLE_LIGHTNING == 1 // Add Shading
        dst = vec4(get_gradient(sampling_pos),1);
        dst = vec4(phong_shading(sampling_pos, dst),1);
#if ENABLE_SHADOWING == 1 // Add Shadows
        if(shading(sampling_pos)){
            dst =  vec4(light_ambient_color,1);
        }
#endif
#endif
        break;
    }

        // increment the ray sampling position
        sampling_pos += ray_increment;

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 


#if TASK == 31
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    float T=1;
    vec3 Intensity= vec3(0,0,0);
    
    while (inside_volume)
    {
        
        // get sample
        float s = get_sample_data(sampling_pos);
        vec4 color = texture(transfer_texture, vec2(s, s));
        vec3 rgb = vec3(color.r,color.g,color.b);
        float Alpha = color.a;

#if ENABLE_OPACITY_CORRECTION == 1 // Opacity Correction
        float d_ref= 255*(sampling_distance/sampling_distance_ref);
        Alpha = 1-pow((1-Alpha),d_ref);
#else
        
#endif
        
        

#if ENABLE_LIGHTNING == 1 // Add Shading
        rgb = phong_shading(sampling_pos, color);
#endif

        vec3 I_current= rgb*(Alpha);
        Intensity = Intensity+(I_current*T);
        T = T*(1-Alpha);
        
        // dummy code
        dst = vec4( Intensity, 1.0);

        // increment the ray sampling position
        sampling_pos += ray_increment;
        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 

    // return the calculated color value
    FragColor = dst;
}
