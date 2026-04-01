let allFilms = [];
let filteredFilms = [];
let currentPage = 1;
let itemsPerPage = 20;
let currentChart = null;
let currentSort = { field: 'box_office', order: 'desc' };

async function loadData() {
    try {
        const response = await fetch('films.json');
        allFilms = await response.json();

        allFilms = allFilms.map(film => ({
            ...film,
            box_office_num: film.box_office ? parseFloat(film.box_office) : 0,
            release_year: film.release_year || 0,
            title: cleanText(film.title),
            director: cleanText(film.director),
            country: cleanText(film.country),
            franchise_name: film.franchise_name ? cleanText(film.franchise_name) : null
        }));

        filteredFilms = [...allFilms];
        applySort();
        updateStats();
        updateFilters();
        renderTable();
        renderChart('top10');
    } catch (error) {
        console.error('Error loading data:', error);
        document.querySelector('.table-wrapper').innerHTML = '<div style="padding: 80px 20px; text-align: center; color: #adb5bd;">No data available</div>';
    }
}

function cleanText(text) {
    if (!text) return text;
    if (typeof text !== 'string') return text;
    return text.replace(/[^\x00-\x7F]/g, '').trim();
}

function formatMoney(value) {
    if (!value || value === 0) return '—';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num) || num === 0) return '—';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
    return `$${num.toLocaleString()}`;
}

function updateStats() {
    const totalFilms = filteredFilms.length;
    const totalRevenue = filteredFilms.reduce((sum, f) => sum + (f.box_office_num || 0), 0);
    const topFilm = [...filteredFilms].sort((a, b) => (b.box_office_num || 0) - (a.box_office_num || 0))[0];
    const uniqueFranchises = new Set(filteredFilms.filter(f => f.franchise_name).map(f => f.franchise_name)).size;

    document.getElementById('total-films').textContent = totalFilms;
    document.getElementById('total-revenue').textContent = formatMoney(totalRevenue);
    document.getElementById('top-film').textContent = topFilm ? (topFilm.title.length > 20 ? topFilm.title.substring(0, 20) + '…' : topFilm.title) : '—';
    document.getElementById('total-franchises').textContent = uniqueFranchises;
}

function updateFilters() {
    const franchises = [...new Set(allFilms.filter(f => f.franchise_name).map(f => f.franchise_name))].sort();
    const franchiseSelect = document.getElementById('franchise-filter');
    franchiseSelect.innerHTML = '<option value="all">All films</option>';
    franchiseSelect.innerHTML += '<option value="no_franchise">Films without franchise</option>';
    franchises.forEach(f => {
        if (f && f.length > 0) {
            franchiseSelect.innerHTML += `<option value="${f}">${f}</option>`;
        }
    });
}

function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const franchise = document.getElementById('franchise-filter').value;
    const yearMin = parseInt(document.getElementById('year-min').value);
    const yearMax = parseInt(document.getElementById('year-max').value);

    filteredFilms = allFilms.filter(film => {
        if (searchTerm && !film.title.toLowerCase().includes(searchTerm)) return false;

        if (franchise !== 'all') {
            if (franchise === 'no_franchise') {
                if (film.franchise_name) return false;
            } else {
                if (film.franchise_name !== franchise) return false;
            }
        }

        if (yearMin && film.release_year < yearMin) return false;
        if (yearMax && film.release_year > yearMax) return false;
        return true;
    });

    applySort();
    currentPage = 1;
    updateStats();
    renderTable();
    renderChart(document.querySelector('.tab-btn.active').dataset.chart);
}

function applySort() {
    filteredFilms.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];

        if (currentSort.field === 'box_office') {
            aVal = a.box_office_num || 0;
            bVal = b.box_office_num || 0;
        } else if (currentSort.field === 'year') {
            aVal = a.release_year || 0;
            bVal = b.release_year || 0;
        } else if (currentSort.field === 'title') {
            aVal = (a.title || '').toLowerCase();
            bVal = (b.title || '').toLowerCase();
        }

        if (currentSort.order === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageFilms = filteredFilms.slice(start, end);

    const tbody = document.querySelector('.films-table tbody');
    tbody.innerHTML = '';

    pageFilms.forEach(film => {
        const row = tbody.insertRow();
        const franchiseDisplay = film.franchise_name
            ? `<span style="background: #e8f5e9; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #2d6a4f;">${film.franchise_name}</span>`
            : '<span style="color: #b8cdc0;">—</span>';

        row.innerHTML = `
            <td><strong>${film.title || '—'}</strong>
            <td>${film.release_year || '—'}
            <td>${film.director || '—'}
            <td style="color: #2d6a4f; font-weight: 600;">${formatMoney(film.box_office_num)}</td>
            <td>${film.country || '—'}
            <td>${franchiseDisplay}</td>
        `;
    });

    const totalPages = Math.ceil(filteredFilms.length / itemsPerPage);
    document.getElementById('page-info').textContent = `${currentPage} of ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages || totalPages === 0;
}

function renderChart(type) {
    if (currentChart) {
        currentChart.destroy();
    }

    const ctx = document.getElementById('mainChart').getContext('2d');
    const mintGreen = '#2d6a4f';
    const mintLight = '#52b788';
    const mintPale = 'rgba(45, 106, 79, 0.1)';

    if (type === 'top10') {
        const top10 = [...filteredFilms]
            .sort((a, b) => (b.box_office_num || 0) - (a.box_office_num || 0))
            .slice(0, 10);

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(f => {
                    // Перенос длинных названий на несколько строк
                    const words = f.title.split(' ');
                    if (words.length > 3) {
                        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
                        const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
                        return [line1, line2];
                    }
                    return f.title;
                }),
                datasets: [{
                    data: top10.map(f => f.box_office_num / 1e9),
                    backgroundColor: mintGreen,
                    borderRadius: 8,
                    barPercentage: 0.7,
                    categoryPercentage: 0.85
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        bottom: 20
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return top10[context[0].dataIndex].title;
                            },
                            label: function(context) {
                                return `Revenue: $${context.raw.toFixed(2)} billion`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'billion USD', color: '#6c9e7a', font: { size: 11 } },
                        grid: { color: '#e0e8e3' },
                        ticks: { color: '#6c9e7a', callback: v => `$${v}B` }
                    },
                    x: {
                        ticks: {
                            color: '#6c9e7a',
                            font: { size: 11, weight: 'normal' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            multiline: true
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    } else if (type === 'timeline') {
        const yearData = {};
        filteredFilms.forEach(f => {
            if (f.release_year && f.box_office_num && f.box_office_num > 0) {
                if (!yearData[f.release_year]) {
                    yearData[f.release_year] = { total: 0, films: [] };
                }
                yearData[f.release_year].total += f.box_office_num;
                yearData[f.release_year].films.push({
                    title: f.title,
                    gross: f.box_office_num
                });
            }
        });

        const sortedYears = Object.keys(yearData).sort();

        if (sortedYears.length === 0) {
            currentChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No data'],
                    datasets: [{
                        data: [0],
                        backgroundColor: '#eef2f6'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
            return;
        }

        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedYears,
                datasets: [{
                    data: sortedYears.map(y => yearData[y].total / 1e9),
                    borderColor: mintGreen,
                    backgroundColor: mintPale,
                    borderWidth: 2.5,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: mintLight,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const year = sortedYears[context[0].dataIndex];
                                return `Year: ${year}`;
                            },
                            label: function(context) {
                                const year = sortedYears[context.dataIndex];
                                const yearTotal = yearData[year].total / 1e9;
                                return `Total Revenue: $${yearTotal.toFixed(2)} billion`;
                            },
                            afterLabel: function(context) {
                                const year = sortedYears[context.dataIndex];
                                const films = yearData[year].films.sort((a, b) => b.gross - a.gross).slice(0, 5);
                                if (films.length === 0) return '';

                                const filmList = films.map(f => `  • ${f.title}: $${(f.gross / 1e9).toFixed(2)}B`).join('\n');
                                return `\nTop films:\n${filmList}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'billion USD', color: '#6c9e7a', font: { size: 11 } },
                        grid: { color: '#e0e8e3' },
                        ticks: { color: '#6c9e7a', callback: v => `$${v}B` }
                    },
                    x: {
                        ticks: {
                            color: '#6c9e7a',
                            font: { size: 11 },
                            maxRotation: 0,
                            minRotation: 0
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    } else if (type === 'franchises') {
        const franchiseRevenue = {};

        filteredFilms.forEach(f => {
            if (f.franchise_name && f.box_office_num && f.box_office_num > 0) {
                if (!franchiseRevenue[f.franchise_name]) {
                    franchiseRevenue[f.franchise_name] = { total: 0, films: [] };
                }
                franchiseRevenue[f.franchise_name].total += f.box_office_num;
                franchiseRevenue[f.franchise_name].films.push({
                    title: f.title,
                    gross: f.box_office_num
                });
            }
        });

        const sortedFranchises = Object.entries(franchiseRevenue)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8);

        if (sortedFranchises.length === 0) {
            currentChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['No franchise data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: '#eef2f6'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: { callbacks: { label: () => 'No franchise data' } },
                        legend: { position: 'right', labels: { color: '#6c9e7a' } }
                    }
                }
            });
            return;
        }

        currentChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: sortedFranchises.map(f => {
                    // Перенос длинных названий франшиз
                    if (f[0].length > 20) {
                        const words = f[0].split(' ');
                        if (words.length > 2) {
                            const mid = Math.ceil(words.length / 2);
                            return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
                        }
                        return [f[0].substring(0, 20), f[0].substring(20)];
                    }
                    return f[0];
                }),
                datasets: [{
                    data: sortedFranchises.map(f => f[1].total / 1e9),
                    backgroundColor: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc', '#e9f5e9'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return sortedFranchises[context[0].dataIndex][0];
                            },
                            label: function(context) {
                                const franchiseName = sortedFranchises[context.dataIndex][0];
                                const total = franchiseRevenue[franchiseName].total / 1e9;
                                const totalAll = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((total / totalAll) * 100).toFixed(1);
                                return `Total Revenue: $${total.toFixed(2)}B (${percentage}%)`;
                            },
                            afterLabel: function(context) {
                                const franchiseName = sortedFranchises[context.dataIndex][0];
                                const films = franchiseRevenue[franchiseName].films
                                    .sort((a, b) => b.gross - a.gross)
                                    .slice(0, 5);

                                if (films.length === 0) return '';

                                const filmList = films.map(f => `  • ${f.title}: $${(f.gross / 1e9).toFixed(2)}B`).join('\n');
                                return `\nTop films:\n${filmList}`;
                            }
                        }
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#6c9e7a',
                            font: { size: 11 },
                            padding: 12
                        }
                    }
                }
            }
        });
    } else if (type === 'franchise-comparison') {
        const franchiseAvg = {};

        filteredFilms.forEach(f => {
            if (f.franchise_name && f.box_office_num && f.box_office_num > 0) {
                if (!franchiseAvg[f.franchise_name]) {
                    franchiseAvg[f.franchise_name] = { total: 0, count: 0, films: [] };
                }
                franchiseAvg[f.franchise_name].total += f.box_office_num;
                franchiseAvg[f.franchise_name].count++;
                franchiseAvg[f.franchise_name].films.push({
                    title: f.title,
                    gross: f.box_office_num
                });
            }
        });

        const topAvg = Object.entries(franchiseAvg)
            .map(([name, data]) => ({
                name,
                avg: data.total / data.count / 1e9,
                count: data.count,
                total: data.total / 1e9,
                films: data.films
            }))
            .filter(f => f.count >= 3)
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 10);

        if (topAvg.length === 0) {
            currentChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['No franchise data'],
                    datasets: [{
                        data: [0],
                        backgroundColor: '#eef2f6'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: { callbacks: { label: () => 'No franchise data' } },
                        legend: { display: false }
                    }
                }
            });
            return;
        }

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topAvg.map(f => {
                    // Перенос длинных названий франшиз
                    const words = f.name.split(' ');
                    if (words.length > 3) {
                        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
                        const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
                        return [line1, line2];
                    }
                    return f.name;
                }),
                datasets: [{
                    data: topAvg.map(f => f.avg),
                    backgroundColor: mintLight,
                    borderRadius: 8,
                    barPercentage: 0.7,
                    categoryPercentage: 0.85
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        bottom: 20
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return topAvg[context[0].dataIndex].name;
                            },
                            label: function(context) {
                                const franchise = topAvg[context.dataIndex];
                                return [
                                    `Average per film: $${franchise.avg.toFixed(2)}B`,
                                    `Total revenue: $${franchise.total.toFixed(2)}B`,
                                    `Number of films: ${franchise.count}`
                                ];
                            },
                            afterLabel: function(context) {
                                const franchise = topAvg[context.dataIndex];
                                const topFilms = franchise.films
                                    .sort((a, b) => b.gross - a.gross)
                                    .slice(0, 3);

                                if (topFilms.length === 0) return '';

                                const filmList = topFilms.map(f => `  • ${f.title}: $${(f.gross / 1e9).toFixed(2)}B`).join('\n');
                                return `\nTop films:\n${filmList}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'average per film (billion USD)', color: '#6c9e7a', font: { size: 11 } },
                        grid: { color: '#e0e8e3' },
                        ticks: { color: '#6c9e7a', callback: v => `$${v}B` }
                    },
                    x: {
                        ticks: {
                            color: '#6c9e7a',
                            font: { size: 10, weight: 'normal' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            multiline: true
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

document.getElementById('search-input').addEventListener('input', applyFilters);
document.getElementById('franchise-filter').addEventListener('change', applyFilters);
document.getElementById('apply-year').addEventListener('click', applyFilters);

document.getElementById('export-csv').addEventListener('click', () => {
    const headers = ['Title', 'Year', 'Director', 'Revenue', 'Country', 'Franchise'];
    const rows = filteredFilms.map(f => [f.title, f.release_year, f.director || '', f.box_office_num || '', f.country || '', f.franchise_name || '']);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'films.csv';
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('sort-by').addEventListener('change', (e) => {
    currentSort.field = e.target.value;
    applyFilters();
});

document.getElementById('sort-order').addEventListener('click', (e) => {
    currentSort.order = currentSort.order === 'desc' ? 'asc' : 'desc';
    e.target.textContent = currentSort.order === 'desc' ? 'Descending' : 'Ascending';
    applyFilters();
});

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
});

document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredFilms.length / itemsPerPage);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderChart(btn.dataset.chart);
    });
});

loadData();