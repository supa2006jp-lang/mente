// Circular fillet tangent to the entrance plane and the spherical cavity.
export function ballJointEntryFilletDimensions(s,radius=s.socketEntryFillet){
 const cavityRadius=s.r+s.effectiveBallClearance,depth=s.splitPosition-s.mouth;
 const originalRadius=Math.sqrt(cavityRadius*cavityRadius-depth*depth);
 const maxEntryRadius=s.core-s.coneDepth-1.2;
 const wallMax=Math.max(0,(maxEntryRadius*maxEntryRadius-originalRadius*originalRadius)/(2*(cavityRadius+depth)));
 // Keep the narrowest part of the rounded lip smaller than the ball.
 const throatLimit=s.r*.99,b=cavityRadius+depth-throatLimit,delta=throatLimit*throatLimit-originalRadius*originalRadius;
 const retentionMax=delta/(b+Math.sqrt(b*b-delta)),maxRadius=Math.min(wallMax,retentionMax);
 const centerRadius=Math.sqrt(originalRadius*originalRadius+2*radius*(cavityRadius+depth)),centerZ=s.mouth+radius;
 const contact=[centerRadius*cavityRadius/(cavityRadius+radius),s.splitPosition+(centerZ-s.splitPosition)*cavityRadius/(cavityRadius+radius)];
 return {radius,maxRadius,entryRadius:centerRadius,centerZ,contact};
}
