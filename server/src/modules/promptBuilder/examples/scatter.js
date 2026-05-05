/**
 * @fileoverview Few-shot example for chart type 'scatter' (scatter plot).
 * D3.js v7, dynamic sizing, tooltip, axes, labels.
 */

export const schema = {
  total_rows: 50,
  columns: [
    { name: 'height_cm', type: 'Numeric', min: 150, max: 200, mean: 175, null_rate: 0 },
    { name: 'weight_kg', type: 'Numeric', min: 50, max: 120, mean: 78, null_rate: 0 },
  ],
  sample: [
    { height_cm: 170, weight_kg: 72 },
    { height_cm: 185, weight_kg: 90 },
    { height_cm: 160, weight_kg: 58 },
  ],
};

export const code = `
function renderChart(data, containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 20, right: 30, bottom: 50, left: 70 };
  const width = (bounds.width || 600) - margin.left - margin.right;
  const height = (bounds.height || 400) - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

  const parsed = data.map(d => ({ x: +d.height_cm, y: +d.weight_kg }));

  const x = d3.scaleLinear()
    .domain(d3.extent(parsed, d => d.x)).nice()
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain(d3.extent(parsed, d => d.y)).nice()
    .range([height, 0]);

  svg.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(x));

  svg.append('g').call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', width / 2).attr('y', height + 40)
    .attr('text-anchor', 'middle').text('Height (cm)');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -55)
    .attr('text-anchor', 'middle').text('Weight (kg)');

  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('background', 'rgba(0,0,0,0.75)')
    .style('color', '#fff')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  svg.selectAll('circle')
    .data(parsed)
    .join('circle')
    .attr('cx', d => x(d.x))
    .attr('cy', d => y(d.y))
    .attr('r', 5)
    .attr('fill', '#4f7cff')
    .attr('opacity', 0.7)
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(\`Height: \${d.x} cm<br>Weight: \${d.y} kg\`);
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));
}
`.trim();

export default { schema, code };
