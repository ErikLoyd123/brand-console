// src/images/perspective.ts
// The math behind the scene+UI composite: given a source rectangle (the crisp card)
// and four destination points (the monitor's corners in the generated photo), build
// the CSS `matrix3d(...)` that warps the card onto that quad. The browser applies
// the transform when we render the composite, so no OpenCV / homography C library
// enters the project.
//
// How it works: a 2D projective transform (homography) H maps (x, y) → (x', y') as
//   x' = (a·x + b·y + c) / (g·x + h·y + 1)
//   y' = (d·x + e·y + f) / (g·x + h·y + 1)
// Eight unknowns (a..h; i is normalised to 1), solved from four point pairs. CSS
// `matrix3d` is a column-major 4×4; the homography embeds into it directly.

export interface Point {
  x: number;
  y: number;
}

// Solve an n×n linear system A·x = b by Gaussian elimination with partial
// pivoting. Small, exact enough for a 8×8 homography solve.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augmented matrix.
  const m = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: swap in the row with the largest magnitude in this column.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) {
      throw new Error('perspective transform is degenerate (collinear corners?)');
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];

    // Eliminate below.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }

  return m.map((row, i) => row[n] / row[i]);
}

// Compute the eight homography coefficients mapping the four `src` corners to the
// four `dst` corners (order must correspond: both as TL, TR, BR, BL).
export function homography(src: Point[], dst: Point[]): number[] {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('homography needs exactly four source and four destination points');
  }
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    // Row for u = (a x + b y + c) / (g x + h y + 1)
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    // Row for v = (d x + e y + f) / (g x + h y + 1)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solve(A, b); // [a, b, c, d, e, f, g, h]
}

// Build the CSS `matrix3d(...)` string that maps the rectangle
// (0,0)-(width,height) onto the destination quad `dst` (TL, TR, BR, BL, in the
// same pixel space the element is positioned in — i.e. the scene's pixels).
export function matrix3dForQuad(width: number, height: number, dst: Point[]): string {
  const src: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const [a, b, c, d, e, f, g, h] = homography(src, dst);
  // Column-major 4×4. The 2D homography sits in the x/y/w rows:
  //   col0: a d 0 g   col1: b e 0 h   col2: 0 0 1 0   col3: c f 0 1
  const m = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((n) => Number(n.toFixed(9))).join(', ')})`;
}
