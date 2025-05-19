// Rating graph component using Chart.js
function createRatingGraph(canvasId, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const theme = localStorage.getItem('theme') || 'dark';
  const textColor = theme === 'light' ? '#000000' : '#ffffff';
  
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Overall Index',
          data: data.index,
          borderColor: '#9C27B0',
          backgroundColor: 'rgba(156, 39, 176, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          order: 1
        },
        {
          label: 'USACO',
          data: data.usaco,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0,  // No curve for USACO since it only steps up
          borderWidth: 2,
          steppedLine: true,
          order: 2
        },
        {
          label: 'Codeforces',
          data: data.cf,
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          order: 3
        },
        {
          label: 'In-House',
          data: data.inhouse,
          borderColor: '#FFC107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          order: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor
          }
        },
        title: {
          display: true,
          text: 'Rating History',
          color: textColor
        }
      },
      scales: {
        x: {
          grid: {
            color: theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          grid: {
            color: theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: textColor
          }
        }
      }
    }
  });
}

// Update graph colors when theme changes
function updateGraphTheme(graph) {
  const theme = localStorage.getItem('theme') || 'dark';
  const textColor = theme === 'light' ? '#000000' : '#ffffff';
  
  graph.options.plugins.legend.labels.color = textColor;
  graph.options.plugins.title.color = textColor;
  graph.options.scales.x.ticks.color = textColor;
  graph.options.scales.y.ticks.color = textColor;
  graph.options.scales.x.grid.color = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  graph.options.scales.y.grid.color = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  graph.update();
}

// Generate dummy data for a user
function generateDummyData(userId) {
  const now = new Date();
  const labels = [];
  const usaco = [];
  const cf = [];
  const inhouse = [];
  const index = [];
  
  // USACO division mapping (can only go up)
  const usacoDivisions = {
    0: 200,  // Not participated
    1: 400,  // Bronze
    2: 600,  // Silver
    3: 800,  // Gold
    4: 1000  // Platinum
  };
  
  // Determine final USACO division based on user ID
  const finalUsacoDiv = Math.min(4, Math.floor(userId % 5));  // 0-4
  
  // Codeforces rating ranges and colors
  const cfRanges = [
    { min: 0, max: 1199, name: "Newbie" },
    { min: 1200, max: 1399, name: "Pupil" },
    { min: 1400, max: 1599, name: "Specialist" },
    { min: 1600, max: 1899, name: "Expert" },
    { min: 1900, max: 2099, name: "Candidate Master" },
    { min: 2100, max: 2399, name: "Master" }
  ];
  
  // Generate base CF rating based on user ID
  const cfRangeIndex = Math.floor(userId % cfRanges.length);
  const cfRange = cfRanges[cfRangeIndex];
  const baseCf = Math.floor(Math.random() * (cfRange.max - cfRange.min + 1)) + cfRange.min;
  
  // Generate 12 months of data
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(date.toLocaleString('default', { month: 'short', year: '2-digit' }));
    
    // Generate realistic looking rating progressions
    const monthProgress = (11 - i) / 11;  // 0 to 1 progress through the year
    
    // USACO: Can only increase in division, steps up
    const currentUsacoDiv = Math.min(finalUsacoDiv, Math.floor(monthProgress * (finalUsacoDiv + 0.99)));
    usaco.push(usacoDivisions[currentUsacoDiv]);
    
    // Codeforces: Realistic rating changes
    // 1. Ratings tend to improve over time but with setbacks
    // 2. Changes are typically between -100 and +100
    // 3. Stay within the assigned rating range
    const trend = monthProgress * 100;  // Overall upward trend
    const variation = (Math.random() * 100 - 50);  // Random variation
    const currentCf = Math.min(cfRange.max, 
                             Math.max(cfRange.min, 
                                    Math.round(baseCf + trend + variation)));
    cf.push(currentCf);
    
    // In-house: Steadily increases with small variations
    const baseInhouse = Math.floor(userId % 100) * 10;
    const inhouseProgress = baseInhouse + (monthProgress * 200);
    inhouse.push(Math.round(inhouseProgress + (Math.random() * 40 - 20)));
    
    // Overall index: Weighted combination of all three
    const currentIndex = (
      (usacoDivisions[currentUsacoDiv] * 0.4) + 
      (Math.min(1000, currentCf / 3) * 0.4) + 
      (Math.min(1000, inhouse[inhouse.length - 1]) * 0.2)
    );
    index.push(Math.round(currentIndex));
  }
  
  return { labels, usaco, cf, inhouse, index };
} 