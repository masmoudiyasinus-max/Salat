import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Flame,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  getRecords,
  computeSummaryStats,
  APP_EVENTS,
} from '../services/storage';
import { DATA_STATUS, getRecordsStatus } from '../services/dataReadiness';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardView({ settings, language }) {
  const lang = language || settings?.language || 'ar';
  const isEn = lang === 'en';

  const [timeframe, setTimeframe] = useState('week'); // 'week' | 'month' | 'all'
  const [records, setRecords] = useState(() => getRecords());

  useEffect(() => {
    const handleRecordsUpdate = (e) => {
      setRecords(e.detail || getRecords());
    };
    window.addEventListener(APP_EVENTS.RECORDS_UPDATED, handleRecordsUpdate);
    window.addEventListener('storage', handleRecordsUpdate);
    return () => {
      window.removeEventListener(APP_EVENTS.RECORDS_UPDATED, handleRecordsUpdate);
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
  const recordsStatus = getRecordsStatus(records);



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
          borderColor: '#ffffff',
          backgroundColor: '#ffffff',
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
            <div style={{ padding: '8px', backgroundColor: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--status-on-time)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

        {recordsStatus === DATA_STATUS.UNAVAILABLE && (
          <div
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              fontSize: '0.88rem',
              color: 'var(--text-muted)',
            }}
          >
            {isEn
              ? 'No prayer records recorded yet. Start recording your daily prayers from the Tracker to view your analytics.'
              : 'لا توجد سجلات صلاة مسجلة بعد. ابدأ بتسجيل صلواتك اليومية من شاشة التتبع لعرض تحليلات ومخططات الأداء بدقة.'}
          </div>
        )}

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
