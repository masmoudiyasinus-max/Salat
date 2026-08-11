import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Flame,
  Moon,
  Sparkles,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  getRecords,
  computeSummaryStats,
  PRAYER_NAMES,
  getPrayerTimesCache,
  calculateNightTimes,
  toWesternDigits,
} from '../services/storage';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardView() {
  const [timeframe, setTimeframe] = useState('month'); // 'week', 'month', 'all'
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const [hoveredDay, setHoveredDay] = useState(null);

  const records = useMemo(() => getRecords(), []);
  const stats = useMemo(() => computeSummaryStats(records), [records]);

  const prayerTimes = useMemo(() => getPrayerTimesCache(), []);
  const nightTimes = useMemo(() => {
    return calculateNightTimes(prayerTimes?.Maghrib || '19:30', prayerTimes?.Fajr || '04:15');
  }, [prayerTimes]);

  // Generate 365-day Heatmap Data (52 weeks x 7 days)
  const heatmapData = useMemo(() => {
    const today = new Date();
    const days = [];

    const recordsByDate = {};
    records.forEach((r) => {
      if (!recordsByDate[r.date]) recordsByDate[r.date] = {};
      recordsByDate[r.date][r.prayer_name] = r;
    });

    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const dayPrayers = recordsByDate[dateStr] || {};
      let issues = 0;
      let countOnTime = 0;

      PRAYER_NAMES.forEach((p) => {
        const pr = dayPrayers[p.id];
        if (pr) {
          if (pr.status === 'late' || pr.status === 'qada' || pr.status === 'missed') {
            issues++;
          } else if (pr.status === 'on_time') {
            countOnTime++;
          }
        }
      });

      let level = 0;
      if (Object.keys(dayPrayers).length === 0) {
        level = 'empty';
      } else if (issues === 0) {
        level = 0;
      } else if (issues === 1) {
        level = 1;
      } else if (issues === 2) {
        level = 2;
      } else if (issues === 3) {
        level = 3;
      } else {
        level = 4;
      }

      days.push({
        date: dateStr,
        level,
        issues,
        countOnTime,
        prayers: dayPrayers,
      });
    }
    return days;
  }, [records]);

  // Aggregate Chart Data
  const chartData = useMemo(() => {
    const daysLimit = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;

    const dates = [];
    const today = new Date();
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const recordsByDate = {};
    records.forEach((r) => {
      if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
      recordsByDate[r.date].push(r);
    });

    const onTimeCounts = [];
    const lateCounts = [];
    const qadaCounts = [];
    const missedCounts = [];

    dates.forEach((dStr) => {
      const list = recordsByDate[dStr] || [];
      let ot = 0, lt = 0, qd = 0, ms = 0;

      list.forEach((r) => {
        if (r.status === 'on_time') ot++;
        else if (r.status === 'late') lt++;
        else if (r.status === 'qada') qd++;
        else if (r.status === 'missed') ms++;
      });

      onTimeCounts.push(ot);
      lateCounts.push(lt);
      qadaCounts.push(qd);
      missedCounts.push(ms);
    });

    return {
      labels: dates.map((d) => d.slice(5)), // MM-DD
      datasets: [
        {
          label: 'في الوقت',
          data: onTimeCounts,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
        {
          label: 'متأخر',
          data: lateCounts,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
        {
          label: 'قضاء',
          data: qadaCounts,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
        {
          label: 'لم تُؤدَّ',
          data: missedCounts,
          borderColor: '#64748b',
          backgroundColor: '#64748b',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
      ],
    };
  }, [records, timeframe]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#f3f4f6',
          font: { family: 'Baloo Bhaijaan 2', size: 12 },
        },
      },
      tooltip: {
        rtl: true,
        bodyFont: { family: 'Baloo Bhaijaan 2' },
        titleFont: { family: 'Baloo Bhaijaan 2' },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#9ca3af', font: { family: 'Baloo Bhaijaan 2' } },
      },
      y: {
        min: 0,
        max: 5,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#9ca3af', font: { family: 'Baloo Bhaijaan 2' }, stepSize: 1 },
      },
    },
  };

  return (
    <div className="dashboard-view">
      {/* Summary Stat Cards */}
      <div className="section-header">
        <div>
          <h2 className="section-title">لوحة التحليلات والإحصائيات</h2>
          <p className="section-subtitle">ملخص شامل لأداء الصلوات والتزام الأوقات السنوية ونظام تقسيم الليل.</p>
        </div>
      </div>

      {/* Night Calculation Division Card */}
      <div
        className="bento-card"
        style={{
          padding: '20px 24px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Moon size={22} style={{ color: 'var(--accent-blue)' }} />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              نظام تقسيم الليل (من المغرب إلى الفجر)
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              مدّة الليل الكلية اليوم: {toWesternDigits(Math.floor(nightTimes.nightDurationMinutes / 60))} ساعة و {toWesternDigits(nightTimes.nightDurationMinutes % 60)} دقيقة
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Midnight Badge */}
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
            }}
          >
            منتصف الليل الشرعي: <strong style={{ color: 'var(--accent-blue)' }}>{nightTimes.midnight12 || `${nightTimes.midnight} ص`}</strong>
          </div>

          {/* Last Third Badge */}
          <div
            style={{
              backgroundColor: 'var(--status-on-time-bg)',
              border: '1px solid rgba(16,185,129,0.3)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.85rem',
              color: 'var(--status-on-time)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={16} />
            <span>الثلث الأخير (أفضل قيام): يبدأ من {nightTimes.lastThird} ص</span>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" id="stat-card-ontime">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-on-time)' }}>
            <CheckCircle size={20} />
            <span className="stat-label">صلوات في الوقت</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-on-time)' }}>{stats.onTime}</div>
        </div>

        <div className="stat-card" id="stat-card-late">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-late)' }}>
            <Clock size={20} />
            <span className="stat-label">صلوات متأخرة</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-late)' }}>{stats.late}</div>
        </div>

        <div className="stat-card" id="stat-card-qada">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-qada)' }}>
            <AlertTriangle size={20} />
            <span className="stat-label">صلوات قضاء</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-qada)' }}>{stats.qada}</div>
        </div>

        <div className="stat-card" id="stat-card-missed">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-missed)' }}>
            <XCircle size={20} />
            <span className="stat-label">صلوات متروكة</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-missed)' }}>{stats.missed}</div>
        </div>

        <div className="stat-card" id="stat-card-avgdelay">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)' }}>
            <Clock size={20} />
            <span className="stat-label">متوسط التأخير العامة</span>
          </div>
          {stats.avgDelay >= 60 ? (
            <div className="stat-value" style={{ fontSize: '1.8rem' }}>
              {Math.floor(stats.avgDelay / 60)} <span style={{ fontSize: '1rem' }}>ساعة</span>
              {stats.avgDelay % 60 > 0 && (
                <>
                  {' و '}{stats.avgDelay % 60} <span style={{ fontSize: '1rem' }}>دقيقة</span>
                </>
              )}
            </div>
          ) : (
            <div className="stat-value">{stats.avgDelay} <span style={{ fontSize: '1rem' }}>دقيقة</span></div>
          )}
        </div>

        <div className="stat-card" id="stat-card-streak">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316' }}>
            <Flame size={20} />
            <span className="stat-label">أطول سلسلة كاملة (Streak)</span>
          </div>
          <div className="stat-value">{stats.maxStreak} <span style={{ fontSize: '1rem' }}>يوم</span></div>
        </div>
      </div>

      {/* GitHub Style Heatmap Card */}
      <div className="bento-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>الخريطة الحرارية السنوية (365 يومًا)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              تدرج الألوان يعكس نسبة الالتزام في كل يوم (الأخضر: كامل الالتزام، الأصفر/الأحمر: وجود تأخير/ترك).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>التزام تام</span>
            <span className="heatmap-cell level-0" style={{ display: 'inline-block' }}></span>
            <span className="heatmap-cell level-1" style={{ display: 'inline-block' }}></span>
            <span className="heatmap-cell level-2" style={{ display: 'inline-block' }}></span>
            <span className="heatmap-cell level-3" style={{ display: 'inline-block' }}></span>
            <span className="heatmap-cell level-4" style={{ display: 'inline-block' }}></span>
            <span>تعثر/تأخير</span>
          </div>
        </div>

        <div className="heatmap-container" style={{ position: 'relative' }}>
          <div className="heatmap-grid">
            {heatmapData.map((d, index) => (
              <div
                key={index}
                className={`heatmap-cell ${d.level === 'empty' ? 'level-empty' : `level-${d.level}`}`}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
              />
            ))}
          </div>

          {hoveredDay && (
            <div className="custom-tooltip">
              <div style={{ fontWeight: '700', marginBottom: '4px' }}>التاريخ: {hoveredDay.date}</div>
              <div>عدد الإشكالات (تأخير/قضاء/ترك): {hoveredDay.issues}</div>
              <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {PRAYER_NAMES.map((p) => {
                  const status = hoveredDay.prayers?.[p.id]?.status || 'غير مسجلة';
                  return (
                    <span key={p.id} style={{ marginLeft: '6px' }}>
                      {p.nameAr}: ({status})
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="bento-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>مخطط أداء الصلوات عبر الزمن (خطي)</h3>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="nav-tabs">
              <button
                className={`nav-btn ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
                id="chart-type-line-btn"
              >
                <TrendingUp size={16} />
                <span>رسم خطي</span>
              </button>
              <button
                className={`nav-btn ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
                id="chart-type-bar-btn"
              >
                <BarChart3 size={16} />
                <span>أعمدة</span>
              </button>
            </div>

            <div className="nav-tabs">
              <button
                className={`nav-btn ${timeframe === 'week' ? 'active' : ''}`}
                onClick={() => setTimeframe('week')}
              >
                أسبوعي
              </button>
              <button
                className={`nav-btn ${timeframe === 'month' ? 'active' : ''}`}
                onClick={() => setTimeframe('month')}
              >
                شهري
              </button>
              <button
                className={`nav-btn ${timeframe === 'all' ? 'active' : ''}`}
                onClick={() => setTimeframe('all')}
              >
                3 أشهر
              </button>
            </div>
          </div>
        </div>

        <div style={{ height: '340px' }}>
          {chartType === 'line' ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
