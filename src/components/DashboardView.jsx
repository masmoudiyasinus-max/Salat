import React, { useState, useMemo, useEffect } from 'react';
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
import { getTranslation } from '../services/i18n';

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

export default function DashboardView({ settings }) {
  const lang = settings?.language || 'ar';
  const isEn = lang === 'en';
  const t = (k, fb) => getTranslation(lang, k, fb);

  const [timeframe, setTimeframe] = useState('month');
  const [chartType, setChartType] = useState('line');
  const [hoveredDay, setHoveredDay] = useState(null);
  const [records, setRecords] = useState(() => getRecords());
  const [prayerTimes, setPrayerTimes] = useState(() => getPrayerTimesCache());

  useEffect(() => {
    const handleRecordsUpdate = (e) => {
      setRecords(e.detail || getRecords());
    };
    const handleTimesUpdate = (e) => {
      setPrayerTimes(e.detail || getPrayerTimesCache());
    };
    window.addEventListener('records-updated', handleRecordsUpdate);
    window.addEventListener('prayer-times-updated', handleTimesUpdate);
    window.addEventListener('storage', handleRecordsUpdate);
    return () => {
      window.removeEventListener('records-updated', handleRecordsUpdate);
      window.removeEventListener('prayer-times-updated', handleTimesUpdate);
      window.removeEventListener('storage', handleRecordsUpdate);
    };
  }, []);

  const filteredRecords = useMemo(() => {
    if (timeframe === 'all') return records;
    const daysLimit = timeframe === 'week' ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);
    return records.filter((r) => r.date >= cutoffStr);
  }, [records, timeframe]);

  const stats = useMemo(() => computeSummaryStats(filteredRecords), [filteredRecords]);

  const nightTimes = useMemo(() => {
    return calculateNightTimes(prayerTimes?.Maghrib, prayerTimes?.Fajr);
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
        level = 0;
      } else if (issues === 0 && countOnTime === 5) {
        level = 4; // Perfect on-time day!
      } else if (issues === 0) {
        level = 3;
      } else if (issues <= 2) {
        level = 2;
      } else {
        level = 1;
      }

      days.push({
        date: dateStr,
        level,
        countOnTime,
        issues,
      });
    }

    return days;
  }, [records]);

  // Generate Chart Data (Line/Bar)
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
          label: isEn ? 'On Time' : 'في الوقت',
          data: onTimeCounts,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
        {
          label: isEn ? 'Late' : 'متأخر',
          data: lateCounts,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
        {
          label: isEn ? 'Qada' : 'قضاء',
          data: qadaCounts,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
        },
        {
          label: isEn ? 'Missed' : 'لم تُؤدَّ',
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
  }, [records, timeframe, isEn]);

  const chartOptions = {
    animation: false,
    animations: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        rtl: !isEn,
        bodyFont: { family: isEn ? 'Inter, sans-serif' : 'Baloo Bhaijaan 2' },
        titleFont: { family: isEn ? 'Inter, sans-serif' : 'Baloo Bhaijaan 2' },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#9ca3af', font: { family: isEn ? 'Inter, sans-serif' : 'Baloo Bhaijaan 2' } },
      },
      y: {
        min: 0,
        max: 5,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#9ca3af', font: { family: isEn ? 'Inter, sans-serif' : 'Baloo Bhaijaan 2' }, stepSize: 1 },
      },
    },
  };

  return (
    <div className="dashboard-view" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Unified Bento Card: Stats Metrics + Analytics Chart */}
      <div className="bento-card" style={{ padding: '28px' }}>
        {/* Header: Title + Timeframe Filter Pills */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--status-on-time)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {isEn ? 'Prayer Performance Trend' : 'مخطط أداء الصلوات عبر الزمن'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                {isEn ? 'Accurate monitoring of commitment rates and metrics across selected timeframe.' : 'متابعة دقيقة لمعدلات الالتزام ومؤشرات الصلوات خلال النطاق الزمني المحدد.'}
              </p>
            </div>
          </div>

          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill-btn ${timeframe === 'week' ? 'active' : ''}`}
              onClick={() => setTimeframe('week')}
            >
              <span>{isEn ? 'Weekly' : 'أسبوعي'}</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${timeframe === 'month' ? 'active' : ''}`}
              onClick={() => setTimeframe('month')}
            >
              <span>{isEn ? 'Monthly' : 'شهري'}</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${timeframe === 'all' ? 'active' : ''}`}
              onClick={() => setTimeframe('all')}
            >
              <span>{isEn ? '3 Months' : '3 أشهر'}</span>
            </button>
          </div>
        </div>

        {/* Integrated Metrics Sub-Grid (Compact Minimalist) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--status-on-time)', fontSize: '0.75rem', fontWeight: '700' }}>
              <CheckCircle size={14} />
              <span>{isEn ? 'On Time' : 'في الوقت'}</span>
            </div>
            <div className="stat-value" style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--status-on-time)', marginTop: '2px' }}>
              {stats.onTime}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--status-late)', fontSize: '0.75rem', fontWeight: '700' }}>
              <Clock size={14} />
              <span>{isEn ? 'Late' : 'متأخرة'}</span>
            </div>
            <div className="stat-value" style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--status-late)', marginTop: '2px' }}>
              {stats.late}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--status-qada)', fontSize: '0.75rem', fontWeight: '700' }}>
              <AlertTriangle size={14} />
              <span>{isEn ? 'Qada' : 'قضاء'}</span>
            </div>
            <div className="stat-value" style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--status-qada)', marginTop: '2px' }}>
              {stats.qada}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--status-missed)', fontSize: '0.75rem', fontWeight: '700' }}>
              <XCircle size={14} />
              <span>{isEn ? 'Missed' : 'متروكة'}</span>
            </div>
            <div className="stat-value" style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--status-missed)', marginTop: '2px' }}>
              {stats.missed}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: '700' }}>
              <Clock size={14} />
              <span>{isEn ? 'Avg Delay' : 'متوسط التأخير'}</span>
            </div>
            {stats.avgDelay >= 60 ? (
              <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                {Math.floor(stats.avgDelay / 60)} <span style={{ fontSize: '0.75rem' }}>{isEn ? 'h' : 'ساعة'}</span>
                {stats.avgDelay % 60 > 0 && ` & ${stats.avgDelay % 60} ${isEn ? 'm' : 'د'}`}
              </div>
            ) : (
              <div className="stat-value" style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                {stats.avgDelay} <span style={{ fontSize: '0.8rem' }}>{isEn ? 'mins' : 'دقيقة'}</span>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f97316', fontSize: '0.75rem', fontWeight: '700' }}>
              <Flame size={14} />
              <span>{isEn ? 'Max Streak' : 'أطول سلسلة'}</span>
            </div>
            <div className="stat-value" style={{ fontSize: '1.45rem', fontWeight: '800', color: '#f97316', marginTop: '2px' }}>
              {stats.maxStreak} <span style={{ fontSize: '0.8rem' }}>{isEn ? 'days' : 'يوم'}</span>
            </div>
          </div>
        </div>

        {/* Chart Line */}
        <div style={{ height: '340px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
