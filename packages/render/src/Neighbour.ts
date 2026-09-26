// The four orthogonal neighbours of a grid cell, as used by terrain
// autotiling (`TerrainMask`). Listed clockwise from North, the order of
// the mask's bits.
export enum Neighbour {
  North = 'north',
  East = 'east',
  South = 'south',
  West = 'west',
}
