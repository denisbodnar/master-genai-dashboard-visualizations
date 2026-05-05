/**
 * @fileoverview Few-shot example for chart type 'line' (line chart).
 * Used by the B_shots block in few-shot and cot modes.
 * D3.js v7, dynamic sizing, tooltip, axes, labels.
 */

export const schema = {
  total_rows: 12,
  columns: [
    { name: 'date', type: 'Temporal', range: ['2023-01-01', '2023-12-01'], step: 'month', null_rate: 0 },
    { name: 'revenue', type: 'Numeric', min: 12000, max: 98000, mean: 54000, null_rate: 0 },
  ],
  sample: [
    { date: '2023-01-01', revenue: 32000 },
    { date: '2023-06-01', revenue: 67000 },
    { date: '2023-12-01', revenue: 45000 },
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

  const parseDate = d3.timeParse('%Y-%m-%d');
  const parsed = data.map(d => ({ date: parseDate(d.date), revenue: +d.revenue }));

  const x = d3.scaleTime()
    .domain(d3.extent(parsed, d => d.date))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(parsed, d => d.revenue) * 1.1])
    .range([height, 0]);

  // Axes
  svg.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %Y')));

  svg.append('g').call(d3.axisLeft(y));

  // Axis labels
  svg.append('text')
    .attr('x', width / 2).attr('y', height + 40)
    .attr('text-anchor', 'middle').text('Date');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -55)
    .attr('text-anchor', 'middle').text('Revenue');

  // Line
  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.revenue))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(parsed)
    .attr('fill', 'none')
    .attr('stroke', '#4f7cff')
    .attr('stroke-width', 2.5)
    .attr('d', line);

  // Tooltip
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
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.revenue))
    .attr('r', 4)
    .attr('fill', '#4f7cff')
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(\`<strong>\${d3.timeFormat('%b %Y')(d.date)}</strong><br>Revenue: \${d.revenue.toLocaleString()}\`);
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));
}
`.trim();

export default { schema, code };
