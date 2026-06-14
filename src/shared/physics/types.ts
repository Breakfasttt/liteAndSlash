export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function checkCircleCollision(c1: Circle, c2: Circle): boolean {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const distanceSq = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;
  return distanceSq < radiusSum * radiusSum;
}

export function checkCircleAABBCollision(circle: Circle, rect: AABB): boolean {
  // Trouver la coordonnée la plus proche sur le rectangle AABB
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  // Distance entre le centre du cercle et ce point le plus proche
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distanceSq = dx * dx + dy * dy;

  return distanceSq < circle.radius * circle.radius;
}
