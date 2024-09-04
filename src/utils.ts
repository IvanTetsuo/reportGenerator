export function average(arr: number[]): number {
    if (!arr.length) {
      return 0;
    }
    let avg = 0;
    for (const num of arr) {
      avg += num;
    }
    return avg / arr.length;
}