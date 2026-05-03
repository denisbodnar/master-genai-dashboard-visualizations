/**
 * @fileoverview Few-shot приклад для типу 'pie' (кругова діаграма).
 * D3.js v7, динамічні розміри, легенда, tooltip.
 */

export const schema = {
  total_rows: 5,
  columns: [
    { name: 'region', type: 'Categorical', cardinality: 5, mode: 'North', null_rate: 0 },
  ],
  sample: [
    { region: 'North' },
    { region: 'South' },
    { region: 'East' },
  ],
};

export const code = `
function renderChart(data, containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const bounds = container.node().getBoundingClientRect();
  const width = bounds.width || 500;
  const height = bounds.height || 400;
  const radius = Math.min(width, height) / 2 - 40;

  const svg = container
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', \`translate(\${width / 2 - 60},\${height / 2})\`);

  // Count occurrences per region
  const counts = {};
  data.forEach(d => { counts[d.region] = (counts[d.region] || 0) + 1; });
  const pieData = Object.entries(counts).map(([key, value]) => ({ key, value }));

  const color = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(pieData.map(d => d.key));

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(0).outerRadius(radius);
  const arcHover = d3.arc().innerRadius(0).outerRadius(radius + 8);

  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('background', 'rgba(0,0,0,0.75)')
    .style('color', '#fff')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  svg.selectAll('path')
    .data(pie(pieData))
    .join('path')
    .attr('d', arc)
    .attr('fill', d => color(d.data.key))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('d', arcHover);
      const total = pieData.reduce((s, x) => s + x.value, 0);
      tooltip.style('opacity', 1)
        .html(\`<strong>\${d.data.key}</strong><br>\${((d.data.value / total) * 100).toFixed(1)}%\`);
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      d3.select(this).attr('d', arc);
      tooltip.style('opacity', 0);
    });

  // Legend
  const legend = container.select('svg').append('g')
    .attr('transform', \`translate(\${width / 2 + radius - 20}, 30)\`);

  pieData.forEach((d, i) => {
    const g = legend.append('g').attr('transform', \`translate(0, \${i * 22})\`);
    g.append('rect').attr('width', 14).attr('height', 14).attr('fill', color(d.key));
    g.append('text').attr('x', 18).attr('y', 12).style('font-size', '13px').text(d.key);
  });
}
`.trim();

export default { schema, code };
