import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, AlertCircle, Users, Wrench, Clock, Video, Image as ImageIcon } from 'lucide-react';

interface IssueMarker {
  id: string;
  lat: number;
  lng: number;
  category: string;
  department: string;
  status: string;
  confirmations: number;
  severity: string;
  timestamp: string;
  mediaType?: 'image' | 'video';
}

interface InteractiveMapProps {
  issues: IssueMarker[];
  onMarkerClick?: (issue: IssueMarker) => void;
}

// Category to color mapping
const categoryColors: Record<string, { bg: string; border: string; icon: string }> = {
  pothole: { bg: '#f97316', border: '#ea580c', icon: '🕳️' },
  flooding: { bg: '#3b82f6', border: '#1d4ed8', icon: '💧' },
  streetlight: { bg: '#fbbf24', border: '#f59e0b', icon: '💡' },
  graffiti: { bg: '#ec4899', border: '#be185d', icon: '✏️' },
  traffic_signal: { bg: '#8b5cf6', border: '#6d28d9', icon: '🚦' },
  tree_hazard: { bg: '#10b981', border: '#059669', icon: '🌳' },
  sidewalk: { bg: '#6366f1', border: '#4f46e5', icon: '🚶' },
  none: { bg: '#6b7280', border: '#4b5563', icon: '❓' },
};

export default function InteractiveMap({ issues, onMarkerClick }: InteractiveMapProps) {
  const [selectedIssue, setSelectedIssue] = useState<IssueMarker | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Derive map bounds dynamically from the actual issues being plotted.
  // The previous version hardcoded NYC-only bounds (40.7-40.8 / -74.0--73.95),
  // which silently pushed every marker off-screen for any report located
  // outside that fixed box (e.g. real GPS coordinates from anywhere else
  // in the world). Computing bounds from the live data ensures every
  // submitted issue always lands inside the visible map, and a single
  // issue is centered instead of collapsing to a 0-width/height box.
  const PADDING_DEGREES = 0.01;

  const mapBounds = (() => {
    if (issues.length === 0) {
      return { minLat: 40.7, maxLat: 40.8, minLng: -74.0, maxLng: -73.95 };
    }

    const lats = issues.map((i) => i.lat);
    const lngs = issues.map((i) => i.lng);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    // Single issue (or all issues at the same point): pad evenly around it
    // so it renders centered rather than dividing by zero.
    if (minLat === maxLat) {
      minLat -= PADDING_DEGREES;
      maxLat += PADDING_DEGREES;
    }
    if (minLng === maxLng) {
      minLng -= PADDING_DEGREES;
      maxLng += PADDING_DEGREES;
    }

    // Add a small margin so markers near the edge aren't clipped by the
    // map border.
    const latMargin = (maxLat - minLat) * 0.15;
    const lngMargin = (maxLng - minLng) * 0.15;

    return {
      minLat: minLat - latMargin,
      maxLat: maxLat + latMargin,
      minLng: minLng - lngMargin,
      maxLng: maxLng + lngMargin,
    };
  })();

  // Convert lat/lng to pixel coordinates on map
  const latToPixel = (lat: number): number => {
    const { minLat, maxLat } = mapBounds;
    const mapHeight = 500;
    return Math.round(mapHeight - ((lat - minLat) / (maxLat - minLat)) * mapHeight);
  };

  const lngToPixel = (lng: number): number => {
    const { minLng, maxLng } = mapBounds;
    const mapWidth = 800;
    return Math.round(((lng - minLng) / (maxLng - minLng)) * mapWidth);
  };

  const getMarkerColor = (category: string) => {
    return categoryColors[category.toLowerCase()] || categoryColors.none;
  };

  const getStatusColor = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'SUBMITTED':
        return '#94a3b8';
      case 'CLASSIFIED':
        return '#3b82f6';
      case 'VERIFICATION':
        return '#10b981';
      case 'ASSIGNED':
        return '#f59e0b';
      case 'IN_PROGRESS':
        return '#f97316';
      case 'PENDING_AUTHORITY':
        return '#06b6d4';
      case 'ACCEPTED':
        return '#14b8a6';
      case 'REPAIR_SCHEDULED':
        return '#a855f7';
      case 'RESOLVED':
        return '#6366f1';
      default:
        return '#6b7280';
    }
  };

  const handleMarkerClick = (issue: IssueMarker) => {
    setSelectedIssue(issue);
    if (onMarkerClick) {
      onMarkerClick(issue);
    }
  };

  return (
    <div className="card p-5 rounded-3xl">
      <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"><MapPin className="w-3 h-3 text-emerald-400" /></div><h2 className="text-xs font-semibold text-slate-300">Active Issues Map</h2></div>

      {issues.length === 0 ? (
        <div className="empty-state">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-3"><MapPin className="w-4 h-4 text-slate-600" /></div>
          <p className="text-xs font-medium text-slate-500">No active reports</p>
          <p className="text-[11px] text-slate-600 mt-1">Map will populate as citizens submit issues.</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Map Section */}
          <div className="flex-1">
            <div className="relative bg-gradient-to-br from-slate-950 to-slate-900 rounded-xl border border-white/[0.07] overflow-hidden" style={{ width: '100%', height: '500px' }}>
              {/* Map grid background */}
              <svg
                width="100%"
                height="100%"
                className="absolute inset-0"
                style={{ zIndex: 0 }}
              >
                <defs>
                  <pattern
                    id="grid"
                    width="50"
                    height="50"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 50 0 L 0 0 0 50"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Markers */}
              <div className="absolute inset-0" style={{ zIndex: 1 }}>
                {issues.map((issue) => {
                  const x = lngToPixel(issue.lng);
                  const y = latToPixel(issue.lat);
                  const color = getMarkerColor(issue.category);
                  const isHovered = hoveredId === issue.id;
                  const isSelected = selectedIssue?.id === issue.id;

                  return (
                    <motion.div
                      key={issue.id}
                      className="absolute cursor-pointer"
                      style={{
                        left: `${(x / 800) * 100}%`,
                        top: `${(y / 500) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: isSelected ? 20 : isHovered ? 10 : 5,
                      }}
                      whileHover={{ scale: 1.2 }}
                      onMouseEnter={() => setHoveredId(issue.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => handleMarkerClick(issue)}
                    >
                      {/* Outer pulsing ring */}
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2"
                          style={{
                            borderColor: color.border,
                            width: '40px',
                            height: '40px',
                            transform: 'translate(-50%, -50%)',
                          }}
                          animate={{
                            scale: [1, 1.3],
                            opacity: [0.8, 0],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                          }}
                        />
                      )}

                      {/* Main marker */}
                      <motion.div
                        className="relative w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold shadow-lg cursor-pointer border-2"
                        style={{
                          backgroundColor: color.bg,
                          borderColor: color.border,
                        }}
                        animate={isHovered ? { scale: 1.3 } : { scale: 1 }}
                      >
                        {color.icon}

                        {/* Hover tooltip */}
                        {isHovered && !isSelected && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-full mb-2 -left-12 bg-slate-950 text-slate-100 px-2 py-1 rounded text-xs whitespace-nowrap border border-slate-700 z-30 shadow-xl"
                          >
                            <p className="font-semibold capitalize">{issue.category}</p>
                            <p className="text-[10px] text-slate-400">{issue.department}</p>
                          </motion.div>
                        )}

                        {/* Click popup - shows issue type, severity, status, department */}
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="absolute bottom-full mb-2 -left-24 w-48 bg-slate-950 text-slate-100 px-3 py-2.5 rounded-lg text-xs border border-slate-700 z-30 shadow-xl"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="font-semibold capitalize">{color.icon} {issue.category}</p>
                              <button
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  setSelectedIssue(null);
                                }}
                                className="text-slate-500 hover:text-slate-300 transition shrink-0 ml-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400">
                                <span className="text-slate-500">Severity:</span>{' '}
                                <span className="text-slate-200 font-mono">{issue.severity}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <span className="text-slate-500">Status:</span>
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: getStatusColor(issue.status) }}
                                />
                                <span className="text-slate-200">{issue.status}</span>
                              </p>
                              <p className="text-[10px] text-slate-400">
                                <span className="text-slate-500">Department:</span>{' '}
                                <span className="text-slate-200">{issue.department}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <span className="text-slate-500">Evidence:</span>
                                {issue.mediaType === 'video' ? <Video className="w-2.5 h-2.5 text-slate-300" /> : <ImageIcon className="w-2.5 h-2.5 text-slate-300" />}
                                <span className="text-slate-200">{issue.mediaType === 'video' ? 'Video' : 'Image'}</span>
                              </p>
                            </div>
                            {/* Pointer triangle */}
                            <div
                              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                              style={{
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid #020617',
                              }}
                            />
                          </motion.div>
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Map Labels */}
              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none" style={{ zIndex: 0 }}>
                <div className="text-xs text-slate-600 font-mono">{Math.abs(mapBounds.maxLat).toFixed(3)}°{mapBounds.maxLat >= 0 ? 'N' : 'S'}</div>
                <div className="text-xs text-slate-600 font-mono">{Math.abs(mapBounds.minLat).toFixed(3)}°{mapBounds.minLat >= 0 ? 'N' : 'S'}</div>
              </div>
              <div className="absolute inset-0 flex justify-between p-4 pointer-events-none" style={{ zIndex: 0 }}>
                <div className="text-xs text-slate-600 font-mono">{Math.abs(mapBounds.minLng).toFixed(3)}°{mapBounds.minLng >= 0 ? 'E' : 'W'}</div>
                <div className="text-xs text-slate-600 font-mono">{Math.abs(mapBounds.maxLng).toFixed(3)}°{mapBounds.maxLng >= 0 ? 'E' : 'W'}</div>
              </div>

              {/* Issues count badge */}
              <div className="absolute top-3 right-3 bg-slate-950/90 border border-white/[0.10] px-3 py-1 rounded-full text-[10px] font-mono text-slate-400 z-10">
                {issues.length} active report{issues.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 card-inner p-3 rounded-lg">
              <p className="text-xs font-semibold text-slate-400 mb-2">Issue Categories</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(categoryColors).map(([category, color]) => (
                  <div key={category} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{
                        backgroundColor: color.bg,
                        borderColor: color.border,
                      }}
                    />
                    <span className="text-[10px] text-slate-500 capitalize">
                      {category === 'traffic_signal' ? 'Signal' : category === 'street_light' ? 'Light' : category === 'tree_hazard' ? 'Tree' : category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Details Panel */}
          {selectedIssue && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-64 card-inner rounded-xl p-4 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="section-label mb-1">
                    {getMarkerColor(selectedIssue.category).icon} {selectedIssue.category}
                  </p>
                  <p className="text-xs font-semibold text-slate-300">Issue Details</p>
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-slate-500 hover:text-slate-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Report ID */}
              <div className="mb-3 pb-3 border-b border-white/[0.06]">
                <p className="section-label mb-1">Report ID</p>
                <p className="text-xs font-mono text-slate-300 break-all">{selectedIssue.id}</p>
              </div>

              {/* Location */}
              <div className="mb-3 pb-3 border-b border-white/[0.06]">
                <p className="section-label flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> Location
                </p>
                <p className="text-xs font-mono text-slate-300">
                  {selectedIssue.lat.toFixed(4)}, {selectedIssue.lng.toFixed(4)}
                </p>
              </div>

              {/* Department */}
              <div className="mb-3 pb-3 border-b border-white/[0.06]">
                <p className="section-label flex items-center gap-1 mb-1">
                  <Wrench className="w-3 h-3" /> Assigned Department
                </p>
                <p className="text-xs font-semibold text-slate-200">{selectedIssue.department}</p>
              </div>

              {/* Evidence (media type) */}
              <div className="mb-3 pb-3 border-b border-white/[0.06]">
                <p className="section-label flex items-center gap-1 mb-1">
                  {selectedIssue.mediaType === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />} Evidence
                </p>
                <p className="text-xs font-semibold text-slate-200">{selectedIssue.mediaType === 'video' ? 'Video' : 'Image'}</p>
              </div>

              {/* Verification Status */}
              <div className="mb-3 pb-3 border-b border-white/[0.06]">
                <p className="section-label flex items-center gap-1 mb-1">
                  <Users className="w-3 h-3" /> Verification
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getStatusColor(selectedIssue.status) }}
                  />
                  <p className="text-xs font-mono text-slate-300">{selectedIssue.confirmations} confirmations</p>
                </div>
              </div>

              {/* Resolution Stage */}
              <div className="mb-3 pb-3 border-b border-white/[0.06]">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Resolution Stage
                </p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStatusColor(selectedIssue.status) }}
                    />
                    <p className="text-xs font-semibold text-slate-200">{selectedIssue.status}</p>
                  </div>
                  {selectedIssue.severity && (
                    <p className="text-xs text-slate-500 ml-4">
                      Severity: <span className="text-slate-300 font-mono">{selectedIssue.severity}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-[10px] text-slate-600">
                <p className="text-slate-500 mb-1">Reported</p>
                <p className="font-mono">{new Date(selectedIssue.timestamp).toLocaleString()}</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
