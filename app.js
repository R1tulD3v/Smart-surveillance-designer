// Smart Surveillance Zone Designer
// Computational Geometry Application

class SurveillanceSystem {
    constructor() {
        this.canvas = document.getElementById('surveillanceCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.sensors = [];
        this.intersections = [];
        this.securePolygon = [];
        this.backgroundImage = null;
        this.nextSensorId = 1;
        
        // Display settings
        this.showBeams = true;
        this.showIntersections = true;
        this.showSecureZone = true;
        this.showGrid = false;
        
        // Colors
        this.colors = {
            sensor: '#ff4444',
            beam: 'rgba(255, 68, 68, 0.6)',
            beamGlow: 'rgba(255, 68, 68, 0.3)',
            intersection: '#ffaa00',
            secureZone: 'rgba(0, 255, 100, 0.15)',
            secureZoneBorder: 'rgba(0, 255, 100, 0.5)',
            grid: 'rgba(255, 255, 255, 0.05)',
            text: '#ffffff'
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.render();
        this.showStatus('Click on canvas to place sensors');
    }
    
    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleCanvasRightClick(e));
        
        // Control buttons
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('loadSampleBtn').addEventListener('click', () => this.loadSample());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('uploadBg').addEventListener('change', (e) => this.uploadBackground(e));
        
        // Toggle controls
        document.getElementById('toggleBeams').addEventListener('change', (e) => {
            this.showBeams = e.target.checked;
            this.render();
        });
        document.getElementById('toggleIntersections').addEventListener('change', (e) => {
            this.showIntersections = e.target.checked;
            this.render();
        });
        document.getElementById('toggleSecureZone').addEventListener('change', (e) => {
            this.showSecureZone = e.target.checked;
            this.render();
        });
        document.getElementById('toggleGrid').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.addSensor(x, y);
    }
    
    handleCanvasRightClick(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.removeSensor(x, y);
    }
    
    addSensor(x, y) {
        const sensor = {
            id: this.nextSensorId++,
            x: x,
            y: y
        };
        this.sensors.push(sensor);
        this.showStatus(`Sensor ${sensor.id} placed at (${Math.round(x)}, ${Math.round(y)})`);
        this.update();
    }
    
    removeSensor(x, y) {
        const radius = 10;
        const index = this.sensors.findIndex(sensor => {
            const dx = sensor.x - x;
            const dy = sensor.y - y;
            return Math.sqrt(dx * dx + dy * dy) < radius;
        });
        
        if (index !== -1) {
            const removed = this.sensors.splice(index, 1)[0];
            this.showStatus(`Sensor ${removed.id} removed`);
            this.update();
        }
    }
    
    update() {
        this.calculateIntersections();
        this.calculateSecureZone();
        this.updateStatistics();
        this.updateSensorList();
        this.render();
    }
    
    // ALGORITHM 1: Line-Line Intersection (O(1) per pair)
    lineIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        // Lines are parallel
        if (Math.abs(denom) < 1e-10) {
            return null;
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // Check if intersection is within both line segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        
        return null;
    }
    
    calculateIntersections() {
        this.intersections = [];
        
        if (this.sensors.length < 4) {
            return;
        }
        
        // Get all beams (pairs of sensors)
        const beams = [];
        for (let i = 0; i < this.sensors.length; i++) {
            for (let j = i + 1; j < this.sensors.length; j++) {
                beams.push([this.sensors[i], this.sensors[j]]);
            }
        }
        
        // Find intersections between all beam pairs
        for (let i = 0; i < beams.length; i++) {
            for (let j = i + 1; j < beams.length; j++) {
                const [p1, p2] = beams[i];
                const [p3, p4] = beams[j];
                
                // Don't check if beams share a sensor
                if (p1 === p3 || p1 === p4 || p2 === p3 || p2 === p4) {
                    continue;
                }
                
                const intersection = this.lineIntersection(p1, p2, p3, p4);
                if (intersection) {
                    this.intersections.push(intersection);
                }
            }
        }
    }
    
    // ALGORITHM 2: Convex Hull using Graham Scan (O(n log n))
    convexHull(points) {
        if (points.length < 3) {
            return points;
        }
        
        // Find the point with lowest y-coordinate (and leftmost if tie)
        let start = points.reduce((min, p) => 
            (p.y < min.y || (p.y === min.y && p.x < min.x)) ? p : min
        );
        
        // Sort points by polar angle with respect to start point
        const sortedPoints = points.filter(p => p !== start).sort((a, b) => {
            const angleA = Math.atan2(a.y - start.y, a.x - start.x);
            const angleB = Math.atan2(b.y - start.y, b.x - start.x);
            if (Math.abs(angleA - angleB) < 1e-10) {
                // If angles are equal, sort by distance
                const distA = (a.x - start.x) ** 2 + (a.y - start.y) ** 2;
                const distB = (b.x - start.x) ** 2 + (b.y - start.y) ** 2;
                return distA - distB;
            }
            return angleA - angleB;
        });
        
        // Build convex hull
        const hull = [start, sortedPoints[0]];
        
        for (let i = 1; i < sortedPoints.length; i++) {
            let top = hull[hull.length - 1];
            let nextToTop = hull[hull.length - 2];
            
            // Remove points that make clockwise turn
            while (hull.length >= 2 && this.crossProduct(nextToTop, top, sortedPoints[i]) <= 0) {
                hull.pop();
                if (hull.length >= 2) {
                    top = hull[hull.length - 1];
                    nextToTop = hull[hull.length - 2];
                }
            }
            
            hull.push(sortedPoints[i]);
        }
        
        return hull;
    }
    
    crossProduct(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    
    calculateSecureZone() {
        if (this.intersections.length < 3) {
            this.securePolygon = [];
            return;
        }
        
        this.securePolygon = this.convexHull(this.intersections);
    }
    
    // ALGORITHM 3: Shoelace Formula for Polygon Area (O(n))
    calculatePolygonArea(polygon) {
        if (polygon.length < 3) {
            return 0;
        }
        
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        
        return Math.abs(area / 2);
    }
    
    updateStatistics() {
        const sensorCount = this.sensors.length;
        const beamCount = sensorCount >= 2 ? (sensorCount * (sensorCount - 1)) / 2 : 0;
        const intersectionCount = this.intersections.length;
        const secureArea = this.calculatePolygonArea(this.securePolygon);
        
        document.getElementById('sensorCount').textContent = sensorCount;
        document.getElementById('beamCount').textContent = beamCount;
        document.getElementById('intersectionCount').textContent = intersectionCount;
        document.getElementById('secureArea').textContent = Math.round(secureArea);
    }
    
    updateSensorList() {
        const listElement = document.getElementById('sensorList');
        
        if (this.sensors.length === 0) {
            listElement.innerHTML = '<div style="color: #777; font-size: 11px;">No sensors placed</div>';
            return;
        }
        
        listElement.innerHTML = this.sensors.map(sensor => 
            `<div class="sensor-item">Sensor ${sensor.id}: (${Math.round(sensor.x)}, ${Math.round(sensor.y)})</div>`
        ).join('');
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background image if exists
        if (this.backgroundImage) {
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw grid
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // Draw secure zone
        if (this.showSecureZone && this.securePolygon.length > 0) {
            this.drawSecureZone();
        }
        
        // Draw beams
        if (this.showBeams && this.sensors.length >= 2) {
            this.drawBeams();
        }
        
        // Draw intersections
        if (this.showIntersections && this.intersections.length > 0) {
            this.drawIntersections();
        }
        
        // Draw sensors
        this.drawSensors();
    }
    
    drawGrid() {
        const gridSize = 50;
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawSensors() {
        this.sensors.forEach(sensor => {
            // Outer glow
            const gradient = this.ctx.createRadialGradient(sensor.x, sensor.y, 0, sensor.x, sensor.y, 15);
            gradient.addColorStop(0, 'rgba(255, 68, 68, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 68, 68, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(sensor.x, sensor.y, 15, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Sensor body
            this.ctx.fillStyle = this.colors.sensor;
            this.ctx.beginPath();
            this.ctx.arc(sensor.x, sensor.y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner highlight
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(sensor.x - 1, sensor.y - 1, 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Sensor ID
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = 'bold 10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(sensor.id.toString(), sensor.x, sensor.y - 18);
        });
    }
    
    drawBeams() {
        for (let i = 0; i < this.sensors.length; i++) {
            for (let j = i + 1; j < this.sensors.length; j++) {
                const s1 = this.sensors[i];
                const s2 = this.sensors[j];
                
                // Beam glow
                this.ctx.strokeStyle = this.colors.beamGlow;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(s1.x, s1.y);
                this.ctx.lineTo(s2.x, s2.y);
                this.ctx.stroke();
                
                // Beam core
                this.ctx.strokeStyle = this.colors.beam;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(s1.x, s1.y);
                this.ctx.lineTo(s2.x, s2.y);
                this.ctx.stroke();
            }
        }
    }
    
    drawIntersections() {
        this.intersections.forEach(point => {
            // Outer glow
            const gradient = this.ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 10);
            gradient.addColorStop(0, 'rgba(255, 170, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Intersection point
            this.ctx.fillStyle = this.colors.intersection;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner highlight
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.arc(point.x - 1, point.y - 1, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawSecureZone() {
        if (this.securePolygon.length < 3) return;
        
        // Fill secure zone
        this.ctx.fillStyle = this.colors.secureZone;
        this.ctx.beginPath();
        this.ctx.moveTo(this.securePolygon[0].x, this.securePolygon[0].y);
        for (let i = 1; i < this.securePolygon.length; i++) {
            this.ctx.lineTo(this.securePolygon[i].x, this.securePolygon[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Border
        this.ctx.strokeStyle = this.colors.secureZoneBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    clearAll() {
        this.sensors = [];
        this.intersections = [];
        this.securePolygon = [];
        this.nextSensorId = 1;
        this.update();
        this.showStatus('All sensors cleared');
    }
    
    loadSample() {
        this.clearAll();
        const sampleSensors = [
            {x: 150, y: 100},
            {x: 650, y: 150},
            {x: 200, y: 500},
            {x: 600, y: 450},
            {x: 400, y: 200}
        ];
        
        sampleSensors.forEach(s => this.addSensor(s.x, s.y));
        this.showStatus('Sample configuration loaded');
    }
    
    exportData() {
        const data = {
            sensors: this.sensors,
            intersections: this.intersections,
            securePolygon: this.securePolygon,
            statistics: {
                sensorCount: this.sensors.length,
                beamCount: this.sensors.length >= 2 ? (this.sensors.length * (this.sensors.length - 1)) / 2 : 0,
                intersectionCount: this.intersections.length,
                secureArea: this.calculatePolygonArea(this.securePolygon)
            }
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'surveillance-config.json';
        link.click();
        
        this.showStatus('Configuration exported successfully');
    }
    
    uploadBackground(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    this.backgroundImage = img;
                    this.render();
                    this.showStatus('Background image loaded');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    
    showStatus(message) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.classList.add('show');
        
        setTimeout(() => {
            statusElement.classList.remove('show');
        }, 2000);
    }
}

// Initialize application
let surveillanceApp;
window.addEventListener('DOMContentLoaded', () => {
    surveillanceApp = new SurveillanceSystem();
});