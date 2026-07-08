from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
import re
import subprocess
import tempfile


SOURCE = Path("public/marleau-art-source.png")
OUT = Path("public/marleau-component-lines.svg")

THRESHOLD = "45%"
MIN_AREA = 24
SEED_MIN_AREA = 8
MAX_COMPONENTS = 320
ERODE_ITERATIONS = 2
INK = "#f7f2ea"
PAPER = "#030303"


Point = tuple[int, int]


@dataclass(frozen=True)
class Component:
  pixels: frozenset[Point]
  area: int
  min_x: int
  min_y: int
  max_x: int
  max_y: int
  cx: float
  cy: float

  @property
  def width(self) -> int:
    return self.max_x - self.min_x + 1

  @property
  def height(self) -> int:
    return self.max_y - self.min_y + 1


def load_white_mask(source: Path) -> list[list[bool]]:
  output = subprocess.check_output(
    [
      "/opt/homebrew/bin/magick",
      str(source),
      "-colorspace",
      "Gray",
      "-threshold",
      THRESHOLD,
      "-compress",
      "none",
      "pbm:-",
    ],
    text=True,
  )
  tokens = [token for line in output.splitlines() if not line.startswith("#") for token in line.split()]
  if tokens[0] != "P1":
    raise ValueError(f"expected PBM P1 output, got {tokens[0]}")

  width = int(tokens[1])
  height = int(tokens[2])
  pixels = tokens[3:]
  if len(pixels) != width * height:
    raise ValueError(f"expected {width * height} pixels, got {len(pixels)}")

  # PBM uses 1 for black and 0 for white. The logo layers are the white ink.
  return [[pixels[y * width + x] == "0" for x in range(width)] for y in range(height)]


def neighbors(y: int, x: int, height: int, width: int) -> list[Point]:
  points: list[Point] = []
  for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
      if dx == 0 and dy == 0:
        continue
      ny = y + dy
      nx = x + dx
      if 0 <= ny < height and 0 <= nx < width:
        points.append((ny, nx))
  return points


def find_components(
  mask: list[list[bool]],
  min_area: int = MIN_AREA,
  max_components: int | None = MAX_COMPONENTS,
) -> list[Component]:
  height = len(mask)
  width = len(mask[0])
  visited = [[False for _ in range(width)] for _ in range(height)]
  components: list[Component] = []

  for y in range(height):
    for x in range(width):
      if visited[y][x] or not mask[y][x]:
        continue

      queue: deque[Point] = deque([(y, x)])
      visited[y][x] = True
      pixels: list[Point] = []

      while queue:
        point = queue.popleft()
        pixels.append(point)
        for ny, nx in neighbors(point[0], point[1], height, width):
          if not visited[ny][nx] and mask[ny][nx]:
            visited[ny][nx] = True
            queue.append((ny, nx))

      area = len(pixels)
      if area < min_area:
        continue

      ys = [point[0] for point in pixels]
      xs = [point[1] for point in pixels]
      components.append(
        Component(
          pixels=frozenset(pixels),
          area=area,
          min_x=min(xs),
          min_y=min(ys),
          max_x=max(xs),
          max_y=max(ys),
          cx=sum(xs) / area,
          cy=sum(ys) / area,
        )
      )

  components.sort(key=lambda component: component.area, reverse=True)
  return components[:max_components] if max_components is not None else components


def erode(mask: list[list[bool]], iterations: int) -> list[list[bool]]:
  current = [row[:] for row in mask]
  height = len(mask)
  width = len(mask[0])

  for _ in range(iterations):
    next_mask = [[False for _ in range(width)] for _ in range(height)]
    for y in range(1, height - 1):
      for x in range(1, width - 1):
        if not current[y][x]:
          continue
        next_mask[y][x] = all(current[ny][nx] for ny, nx in neighbors(y, x, height, width))
    current = next_mask

  return current


def partition_from_seeds(mask: list[list[bool]], seeds: list[Component]) -> list[Component]:
  height = len(mask)
  width = len(mask[0])
  labels = [[-1 for _ in range(width)] for _ in range(height)]
  queue: deque[Point] = deque()

  for label, seed in enumerate(seeds):
    for y, x in seed.pixels:
      labels[y][x] = label
      queue.append((y, x))

  while queue:
    y, x = queue.popleft()
    label = labels[y][x]
    for ny, nx in neighbors(y, x, height, width):
      if mask[ny][nx] and labels[ny][nx] == -1:
        labels[ny][nx] = label
        queue.append((ny, nx))

  pixels_by_label: list[list[Point]] = [[] for _ in seeds]
  for y in range(height):
    for x in range(width):
      label = labels[y][x]
      if label >= 0:
        pixels_by_label[label].append((y, x))

  components: list[Component] = []
  for pixels in pixels_by_label:
    area = len(pixels)
    if area < MIN_AREA:
      continue

    ys = [point[0] for point in pixels]
    xs = [point[1] for point in pixels]
    components.append(
      Component(
        pixels=frozenset(pixels),
        area=area,
        min_x=min(xs),
        min_y=min(ys),
        max_x=max(xs),
        max_y=max(ys),
        cx=sum(xs) / area,
        cy=sum(ys) / area,
      )
    )

  components.sort(key=lambda component: component.area, reverse=True)
  return components[:MAX_COMPONENTS]


def layer_for(component: Component) -> str:
  if component.cy < 230:
    return "mountain"
  if 290 < component.cy < 520 and 310 < component.cx < 650:
    return "vortex"
  if component.cx < 455:
    return "left"
  if component.cx > 520:
    return "right"
  return "core"


def component_to_pbm(component: Component, destination: Path) -> None:
  pad = 3
  width = component.width + pad * 2
  height = component.height + pad * 2
  pixels = [["0" for _ in range(width)] for _ in range(height)]

  for y, x in component.pixels:
    local_y = y - component.min_y + pad
    local_x = x - component.min_x + pad
    pixels[local_y][local_x] = "1"

  rows = [" ".join(row) for row in pixels]
  destination.write_text(f"P1\n{width} {height}\n" + "\n".join(rows) + "\n")


def trace_component(component: Component, index: int, temp_dir: Path) -> str:
  pbm_path = temp_dir / f"component-{index:04d}.pbm"
  component_to_pbm(component, pbm_path)
  svg = subprocess.check_output(
    [
      "/opt/homebrew/bin/potrace",
      "-s",
      "--flat",
      "--tight",
      "--turdsize",
      "0",
      "--opttolerance",
      "0.18",
      "--color",
      INK,
      str(pbm_path),
      "-o",
      "-",
    ],
    text=True,
  )
  match = re.search(r'<path d="([^"]+)"', svg)
  if not match:
    raise ValueError(f"no path output for component {index}")
  return match.group(1)


def format_number(value: float) -> str:
  text = f"{value:.1f}"
  return text[:-2] if text.endswith(".0") else text


def globalize_path(d: str, x: int, y: int, local_height: int) -> str:
  command_sizes = {
    "M": 2,
    "L": 2,
    "T": 2,
    "C": 6,
    "S": 4,
    "Q": 4,
    "H": 1,
    "V": 1,
    "Z": 0,
  }
  parts = re.findall(r"[A-Za-z]|-?\d+(?:\.\d+)?", d)
  output: list[str] = []
  index = 0
  command = ""

  while index < len(parts):
    token = parts[index]
    if re.match(r"[A-Za-z]", token):
      command = token
      output.append(command)
      index += 1
      if command.upper() == "Z":
        continue

    upper = command.upper()
    size = command_sizes.get(upper)
    if not size:
      raise ValueError(f"unsupported SVG path command: {command}")

    coords: list[float] = []
    while index < len(parts) and not re.match(r"[A-Za-z]", parts[index]):
      coords.append(float(parts[index]))
      index += 1

    transformed: list[str] = []
    for coord_index, value in enumerate(coords):
      is_relative = command.islower()
      if upper == "H":
        next_value = value * 0.1 if is_relative else x + value * 0.1
      elif upper == "V":
        next_value = value * -0.1 if is_relative else y + local_height - value * 0.1
      else:
        is_x = coord_index % 2 == 0
        if is_relative:
          next_value = value * 0.1 if is_x else value * -0.1
        else:
          next_value = x + value * 0.1 if is_x else y + local_height - value * 0.1
      transformed.append(format_number(next_value))

    output.append(" ".join(transformed))

  return " ".join(part for part in output if part)


def write_svg(components: list[Component], width: int, height: int) -> None:
  layer_order = ["mountain", "left", "right", "core", "vortex"]
  groups = {layer: [] for layer in layer_order}

  with tempfile.TemporaryDirectory() as temp:
    temp_dir = Path(temp)
    for index, component in enumerate(components):
      d = trace_component(component, index, temp_dir)
      layer = layer_for(component)
      pad = 3
      local_height = component.height + pad * 2
      x = component.min_x - pad
      y = component.min_y - pad
      global_d = globalize_path(d, x, y, local_height)
      groups[layer].append(
        f'<path class="logo-component logo-component-{layer}" data-component-index="{index}" '
        f'data-area="{component.area}" data-cx="{component.cx:.1f}" data-cy="{component.cy:.1f}" '
        f'd="{global_d}"/>'
      )

  body = "\n".join(
    f'<g id="component-layer-{layer}" fill="{INK}">\n' + "\n".join(groups[layer]) + "\n</g>"
    for layer in layer_order
    if groups[layer]
  )

  svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">MARLEΛU component line layers</title>
  <desc id="desc">Connected white ink components from the MARLEΛU mountain and vortex artwork.</desc>
  <rect width="{width}" height="{height}" fill="{PAPER}"/>
{body}
</svg>
'''
  OUT.write_text(svg)

  print(f"wrote {OUT} with {len(components)} components")
  for layer in layer_order:
    print(f"{layer}: {len(groups[layer])}")
  print("largest areas:", ", ".join(str(component.area) for component in components[:8]))


def main() -> None:
  mask = load_white_mask(SOURCE)
  seeds = find_components(erode(mask, ERODE_ITERATIONS), min_area=SEED_MIN_AREA, max_components=None)
  components = partition_from_seeds(mask, seeds)
  print(f"seed components: {len(seeds)}")
  write_svg(components, len(mask[0]), len(mask))


if __name__ == "__main__":
  main()
