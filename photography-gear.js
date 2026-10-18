/* Detailed, procedural photography equipment for the existing hero.
 * Built against the page's pinned Three.js r128; no extra asset downloads.
 */
(() => {
    'use strict';
    const canvas = document.getElementById('hero-3d-canvas');
    const hero = document.getElementById('home');
    if (!canvas || !hero) return;
    const desktop = matchMedia('(min-width: 992px)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let initialized = false;
    let disposed = false;
    let visible = true;
    let frame = 0;
    let renderFrame;
    let invalidate = () => {};
    const resources = new Set();
    const retain = value => { resources.add(value); return value; };

    function initialize() {
        if (initialized || disposed || !desktop.matches || !window.THREE) return;
        initialized = true;
        const T = window.THREE;
        let renderer;
        try {
            renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
        } catch (_) {
            canvas.dataset.gearState = 'unavailable';
            return;
        }
        renderer.outputEncoding = T.sRGBEncoding;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.92;
        renderer.physicallyCorrectLights = true;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.autoClear = false;
        renderer.setClearColor(0x000000, 0);
        const color = hex => new T.Color(hex).convertSRGBToLinear();
        const standard = (hex, roughness, metalness = 0, extra = {}) => retain(new T.MeshStandardMaterial({ color: color(hex), roughness, metalness, ...extra }));
        const physical = (hex, roughness, metalness = 0, extra = {}) => retain(new T.MeshPhysicalMaterial({ color: color(hex), roughness, metalness, ...extra }));
        const basic = (hex, extra = {}) => retain(new T.MeshBasicMaterial({ color: color(hex), ...extra }));
        const geometryCache = new Map();
        function geometry(key, factory) {
            if (!geometryCache.has(key)) geometryCache.set(key, retain(factory()));
            return geometryCache.get(key);
        }

        // A rounded cuboid sampled face by face. Normals follow the corner radius;
        // center spans stay flat instead of turning the whole housing into a sphere.
        function roundedBox(w, h, d, radius = 0.06) {
            return geometry(`box:${w}:${h}:${d}:${radius}`, () => {
                const r = Math.min(radius, w / 2, h / 2, d / 2);
                const halves = [w / 2, h / 2, d / 2];
                const core = halves.map(v => v - r);
                const stops = [-1, -0.92388, -0.7071, -0.38268, -0.00001, 0.00001, 0.38268, 0.7071, 0.92388, 1];
                const vertices = [], normals = [], uv = [];
                const axes = [[0,1,2,1],[0,2,1,-1],[1,2,0,1],[1,0,2,-1],[2,0,1,1],[2,1,0,-1]];
                for (const [axis,u,v,sign] of axes) {
                    function point(a,b) {
                        const n = [0,0,0]; n[axis] = sign; n[u] = a; n[v] = b;
                        const length = Math.hypot(...n);
                        for(let i=0;i<3;i++) n[i] /= length;
                        const p=n.map((value,i)=>Math.sign(value)*core[i]+value*r);
                        return {p,n,uv:[p[u]/(halves[u]*2)+0.5,p[v]/(halves[v]*2)+0.5]};
                    }
                    for(let j=0;j<stops.length-1;j++) for(let i=0;i<stops.length-1;i++) {
                        const quad=[point(stops[i],stops[j]),point(stops[i+1],stops[j]),point(stops[i+1],stops[j+1]),point(stops[i],stops[j+1])];
                        for(const k of [0,1,2,0,2,3]) {vertices.push(...quad[k].p);normals.push(...quad[k].n);uv.push(...quad[k].uv);}
                    }
                }
                const g = new T.BufferGeometry();
                g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
                g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
                g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
                return g;
            });
        }
        function mesh(parent, geo, mat, x=0,y=0,z=0) {
            const object = new T.Mesh(geo,mat);
            object.position.set(x,y,z);
            object.castShadow = true;
            object.receiveShadow = true;
            parent.add(object);
            return object;
        }
        function box(parent, size, mat, position=[0,0,0], r=0.06) {
            return mesh(parent,roundedBox(...size,r),mat,...position);
        }
        function cylinder(parent,radius,depth,mat,position=[0,0,0],axis='z',bottom=radius) {
            const obj=mesh(parent,geometry(`cyl:${radius}:${bottom}:${depth}`,()=>new T.CylinderGeometry(radius,bottom,depth,48)),mat,...position);
            if(axis==='z') obj.rotation.x=Math.PI/2;
            if(axis==='x') obj.rotation.z=Math.PI/2;
            return obj;
        }
        function torus(parent,radius,tube,mat,position=[0,0,0],axis='z') {
            const obj=mesh(parent,geometry(`torus:${radius}:${tube}`,()=>new T.TorusGeometry(radius,tube,12,64)),mat,...position);
            if(axis==='y') obj.rotation.x=Math.PI/2;
            if(axis==='x') obj.rotation.y=Math.PI/2;
            return obj;
        }
        function sphere(parent,size,mat,position=[0,0,0]) {
            const obj=mesh(parent,geometry('sphere',()=>new T.SphereGeometry(1,48,24)),mat,...position);
            obj.scale.set(...size);
            return obj;
        }
        function beam(parent,a,b,width,depth,mat) {
            const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
            const obj=box(parent,[width,delta.length(),depth],mat,start.clone().add(end).multiplyScalar(0.5).toArray(),Math.min(width,depth)*0.28);
            obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
            return obj;
        }
        function texture(w,h,paint) {
            const c=document.createElement('canvas');c.width=w;c.height=h;
            paint(c.getContext('2d'),w,h);
            const map=retain(new T.CanvasTexture(c));
            map.encoding=T.sRGBEncoding;
            map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
            return map;
        }
        let seed=42;
        function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
        const grain=texture(256,256,(ctx,w,h)=>{
            ctx.fillStyle='#898989';ctx.fillRect(0,0,w,h);
            for(let i=0;i<14000;i++) {
                const value=Math.floor(95+random()*90);ctx.fillStyle=`rgb(${value},${value},${value})`;
                ctx.beginPath();ctx.ellipse(random()*w,random()*h,0.5+random()*1.6,0.5+random(),random()*Math.PI,0,Math.PI*2);ctx.fill();
            }
        });
        grain.encoding=T.LinearEncoding;grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,3);
        const body=standard('#303337',0.42,0.12);
        const rubber=standard('#181a1b',0.85,0,{bumpMap:grain,bumpScale:0.013});
        const black=standard('#101316',0.32,0.22);
        const alloy=standard('#a0a6ad',0.25,0.85);
        const graphite=standard('#51555b',0.34,0.55);
        const lightShell=standard('#bfc1c0',0.46,0.08);
        const shellSeam=standard('#54595c',0.65);
        const red=standard('#a41b23',0.36,0.1);
        const glass=physical('#284843',0.035,0.05,{clearcoat:1,clearcoatRoughness:0.025,transparent:true,opacity:0.42,envMapIntensity:1.8,depthWrite:false});
        const opticalBlack=standard('#091014',0.12,0.35);
        const greenLED=basic('#71dcaa',{toneMapped:false});
        const redLED=basic('#f65948',{toneMapped:false});
        const whiteInk=basic('#e4e5e3');

        // PMREM filters the studio's large softboxes into physically based reflections.
        const studio=new T.Scene();
        studio.add(new T.Mesh(new T.BoxGeometry(30,30,30),new T.MeshBasicMaterial({color:0x404449,side:T.BackSide})));
        function softbox(position,size,intensity,tint=0xffffff) {
            const material=new T.MeshBasicMaterial({color:new T.Color(tint).multiplyScalar(intensity),side:T.DoubleSide});
            const panel=new T.Mesh(new T.PlaneGeometry(...size),material);panel.position.set(...position);panel.lookAt(0,0,0);studio.add(panel);
        }
        softbox([-6,7,6],[4,8],7);
        softbox([5,3,3],[2,7],4,0xe6efff);
        softbox([1,8,-5],[7,3],6);
        softbox([0,-3,8],[6,1],1.2);
        const pmrem=new T.PMREMGenerator(renderer);
        const environment=retain(pmrem.fromScene(studio,0.04));
        pmrem.dispose();
        studio.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material.dispose();}});

        function label(parent,text,w,h,position,options={}) {
            const map=texture(512,128,(ctx,cw,ch)=>{
                ctx.clearRect(0,0,cw,ch);ctx.fillStyle=options.color||'#d6d9dd';ctx.font=`${options.weight||500} ${options.fontSize||64}px Arial`;
                ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cw/2,ch/2);
            });
            const mat=basic('#ffffff',{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
            const obj=mesh(parent,geometry(`plane:${w}:${h}`,()=>new T.PlaneGeometry(w,h)),mat,...position);obj.castShadow=false;
            return obj;
        }
        function screw(parent,x,y,z,r=0.022) {
            cylinder(parent,r,0.008,graphite,[x,y,z]);
            box(parent,[r*1.1,r*0.15,0.002],black,[x,y,z+0.005],0.001).rotation.z=Math.PI/4;
        }
        function knurl(parent,radius,depth,z,mat,count=64) {
            const geo=geometry(`rib:${depth}`,()=>new T.BoxGeometry(0.012,depth,0.012));
            const ribs=retain(new T.InstancedMesh(geo,mat,count));
            const dummy=new T.Object3D();
            for(let i=0;i<count;i++) {
                const angle=i/count*Math.PI*2;dummy.position.set(Math.sin(angle)*radius,Math.cos(angle)*radius,z);
                dummy.rotation.set(Math.PI/2,0,-angle);dummy.updateMatrix();ribs.setMatrixAt(i,dummy.matrix);
            }
            ribs.castShadow=true;ribs.receiveShadow=true;parent.add(ribs);
        }
        function screenTexture() {
            const map=texture(512,320,(ctx,w,h)=>{
                const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#244a61');g.addColorStop(0.55,'#829e98');g.addColorStop(1,'#263e2b');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
                ctx.fillStyle='#304a40';ctx.beginPath();ctx.moveTo(0,210);ctx.lineTo(100,90);ctx.lineTo(180,180);ctx.lineTo(300,110);ctx.lineTo(512,240);ctx.lineTo(512,320);ctx.lineTo(0,320);ctx.fill();
                drawCameraUI(ctx,w,h);
            });
            const image=new Image();
            image.onload=()=>{
                if(disposed)return;
                const ctx=map.image.getContext('2d'),w=512,h=320;
                const scale=Math.max(w/image.width,h/image.height);
                ctx.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale);
                ctx.fillStyle='rgba(3,10,17,0.15)';ctx.fillRect(0,0,w,h);drawCameraUI(ctx,w,h);map.needsUpdate=true;invalidate();
            };
            image.src='images/img7-jpg.webp';
            return map;
        }
        function drawCameraUI(ctx,w,h) {
            ctx.strokeStyle='rgba(255,255,255,0.27)';ctx.lineWidth=1;
            for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(w*i/3,30);ctx.lineTo(w*i/3,h-30);ctx.stroke();ctx.beginPath();ctx.moveTo(15,h*i/3);ctx.lineTo(w-15,h*i/3);ctx.stroke();}
            ctx.fillStyle='rgba(2,8,12,0.7)';ctx.fillRect(0,0,w,32);ctx.fillRect(0,h-32,w,32);
            ctx.fillStyle='#f4f6f5';ctx.font='17px monospace';ctx.fillText('M   4K / 30',16,23);ctx.fillText('86%',w-68,23);ctx.fillText('1/125    F2.8    ISO 200',16,h-11);
            ctx.strokeStyle='#e5efd6';ctx.lineWidth=2;ctx.strokeRect(w/2-28,h/2-25,56,50);
            ctx.fillStyle='#dc4a44';ctx.beginPath();ctx.arc(w-27,h-16,6,0,Math.PI*2);ctx.fill();
        }
        const display=retain(new T.MeshBasicMaterial({map:screenTexture(),toneMapped:false}));

        function createCamera() {
            const group=new T.Group();group.name='Detailed mirrorless camera';
            box(group,[1.6,1.03,0.56],body,[0,0,0],0.12);
            box(group,[1.49,0.78,0.065],rubber,[0,-0.06,0.29],0.06);
            box(group,[0.46,1.02,0.77],rubber,[-0.64,-0.025,0.14],0.15);
            box(group,[0.45,0.17,0.7],body,[-0.64,0.46,0.14],0.07);
            box(group,[0.5,0.29,0.47],body,[0.06,0.58,-0.015],0.085);
            box(group,[0.31,0.13,0.045],rubber,[0.06,0.6,-0.265],0.035);
            box(group,[0.21,0.075,0.015],opticalBlack,[0.06,0.6,-0.292],0.015);
            box(group,[0.28,0.025,0.25],alloy,[0.06,0.735,-0.04],0.008);
            box(group,[0.2,0.015,0.22],black,[0.06,0.752,-0.04],0.005);
            for(const x of [-0.075,0.195])box(group,[0.018,0.04,0.25],alloy,[x,0.752,-0.04],0.006);
            cylinder(group,0.105,0.05,alloy,[-0.66,0.57,0.32],'y');
            cylinder(group,0.075,0.015,black,[-0.66,0.602,0.32],'y');
            cylinder(group,0.17,0.095,rubber,[0.57,0.565,-0.03],'y');
            cylinder(group,0.145,0.01,body,[0.57,0.62,-0.03],'y');
            for(let i=0;i<10;i++){const a=i*Math.PI/5;box(group,[0.014,0.006,0.03],whiteInk,[0.57+Math.sin(a)*0.12,0.628,-0.03+Math.cos(a)*0.12],0.001).rotation.y=a;}
            for(const x of [-0.87,0.86])torus(group,0.055,0.013,alloy,[x,0.34,-0.01]);
            const lens=new T.Group();lens.position.set(0.12,-0.04,0);group.add(lens);
            cylinder(lens,0.47,0.12,alloy,[0,0,0.34]);
            cylinder(lens,0.465,0.18,body,[0,0,0.44]);
            cylinder(lens,0.44,0.42,black,[0,0,0.68]);
            cylinder(lens,0.45,0.24,rubber,[0,0,0.69]);knurl(lens,0.45,0.21,0.69,body);
            cylinder(lens,0.422,0.24,body,[0,0,0.94]);
            cylinder(lens,0.43,0.1,rubber,[0,0,0.96]);knurl(lens,0.43,0.09,0.96,body);
            torus(lens,0.426,0.013,red,[0,0,1.025]);
            cylinder(lens,0.43,0.1,black,[0,0,1.075]);
            torus(lens,0.405,0.018,graphite,[0,0,1.13]);
            cylinder(lens,0.385,0.008,opticalBlack,[0,0,1.13]);
            for(const [r,z] of [[0.335,1.14],[0.265,1.145],[0.19,1.15]])torus(lens,r,0.009,black,[0,0,z]);
            cylinder(lens,0.115,0.006,basic('#020506'),[0,0,1.151]);
            const blades=standard('#27352f',0.36,0.6);
            for(let i=0;i<7;i++){
                const shape=new T.Shape();shape.moveTo(0.08,0.06);shape.lineTo(0.13,0.19);shape.lineTo(0.25,0.13);shape.lineTo(0.19,-0.08);shape.closePath();
                const blade=mesh(lens,retain(new T.ShapeGeometry(shape)),blades,0,0,1.154);blade.rotation.z=i*Math.PI*2/7;
            }
            // The recessed optical stack adds dark depth, iris blades and coated-glass
            // reflections; the curved physical surface contributes moving catchlights.
            const opticalMap=texture(512,512,(ctx,w,h)=>{
                const cx=w/2,cy=h/2;
                const g=ctx.createRadialGradient(cx,cy,25,cx,cy,256);
                g.addColorStop(0,'#030608');g.addColorStop(0.26,'#050b10');g.addColorStop(0.44,'#182322');g.addColorStop(0.65,'#142423');g.addColorStop(0.83,'#111c20');g.addColorStop(0.94,'#2b2b3b');g.addColorStop(1,'#06090d');
                ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
                for(let i=0;i<8;i++){
                    ctx.save();ctx.translate(cx,cy);ctx.rotate(i*Math.PI/4);
                    ctx.fillStyle=i%2?'#151d20':'#1a2223';ctx.beginPath();ctx.moveTo(41,38);ctx.lineTo(64,106);ctx.lineTo(126,83);ctx.lineTo(95,-36);ctx.closePath();ctx.fill();ctx.restore();
                }
                ctx.strokeStyle='rgba(107,152,144,0.25)';ctx.lineWidth=2;
                for(const radius of [119,165,212,241]){ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();}
                ctx.save();ctx.translate(145,117);ctx.rotate(-0.48);ctx.shadowColor='rgba(157,214,213,0.65)';ctx.shadowBlur=25;
                const reflection=ctx.createLinearGradient(-58,0,58,0);reflection.addColorStop(0,'rgba(181,215,225,0.02)');reflection.addColorStop(0.3,'rgba(190,218,224,0.55)');reflection.addColorStop(0.7,'rgba(190,218,224,0.22)');reflection.addColorStop(1,'rgba(190,218,224,0)');
                ctx.fillStyle=reflection;ctx.fillRect(-58,-26,116,52);ctx.restore();
                ctx.strokeStyle='rgba(161,116,190,0.4)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,221,0.3,1.15);ctx.stroke();
            });
            const opticalFace=mesh(lens,geometry('lens-optical-face',()=>new T.CircleGeometry(0.363,64)),basic('#ffffff',{map:opticalMap}),0,0,1.16);opticalFace.castShadow=false;
            const frontGlass=glass.clone();frontGlass.opacity=0.16;retain(frontGlass);
            sphere(lens,[0.362,0.362,0.035],frontGlass,[0,0,1.166]).castShadow=false;
            const coating=physical('#513b68',0.02,0.05,{transparent:true,opacity:0.12,clearcoat:1,depthWrite:false});
            sphere(lens,[0.29,0.29,0.025],coating,[0,0,1.19]).castShadow=false;
            label(group,'NH',0.23,0.075,[0.1,0.56,0.239],{weight:700});
            label(group,'α 7',0.15,0.055,[0.59,0.3,0.288]);
            label(lens,'24–70',0.26,0.055,[0,-0.31,1.128]);
            cylinder(group,0.022,0.012,redLED,[-0.35,0.33,0.336]);
            for(const [x,y] of [[0.67,-0.35],[-0.39,-0.4],[0.55,0.4]])screw(group,x,y,0.322,0.018);
            box(group,[1.1,0.73,0.025],rubber,[-0.13,-0.03,-0.299],0.045);
            const screen=mesh(group,geometry('camera-screen',()=>new T.PlaneGeometry(0.98,0.61)),display,-0.13,-0.03,-0.315);screen.rotation.y=Math.PI;screen.castShadow=false;
            return group;
        }

        function createGimbal() {
            const group=new T.Group();group.name='Three-axis phone gimbal';
            const shell=standard('#7b8082',0.46,0.16);
            box(group,[0.27,1.03,0.29],shell,[-0.24,-0.62,0],0.12);
            box(group,[0.23,0.62,0.035],rubber,[-0.24,-0.76,0.147],0.04);
            cylinder(group,0.14,0.065,black,[-0.24,-1.14,0],'y');
            box(group,[0.285,0.31,0.32],shell,[-0.24,-0.14,0.025],0.09);
            cylinder(group,0.057,0.027,rubber,[-0.24,-0.10,0.195]);
            cylinder(group,0.034,0.035,black,[-0.24,-0.1,0.216]);
            cylinder(group,0.025,0.015,red,[-0.18,-0.22,0.19]);
            cylinder(group,0.023,0.015,black,[-0.30,-0.22,0.19]);
            for(let i=0;i<3;i++)sphere(group,[0.008,0.008,0.005],greenLED,[-0.275+i*0.035,0.005,0.185]);
            beam(group,[-0.24,0.01,-0.055],[-0.03,0.26,-0.10],0.15,0.12,shell);
            cylinder(group,0.125,0.12,graphite,[-0.04,0.27,-0.04]);
            cylinder(group,0.097,0.012,alloy,[-0.04,0.27,0.027]);
            beam(group,[-0.04,0.27,-0.10],[0.54,0.27,-0.10],0.105,0.12,shell);
            beam(group,[0.54,0.27,-0.1],[0.54,0.59,-0.1],0.105,0.12,shell);
            cylinder(group,0.11,0.15,graphite,[0.56,0.59,-0.03],'x');
            cylinder(group,0.092,0.012,alloy,[0.64,0.59,-0.03],'x');
            box(group,[0.2,0.73,0.13],black,[0.03,0.59,0.015],0.045);
            const phone=new T.Group();phone.position.set(0.03,0.6,0.11);group.add(phone);
            box(phone,[1.31,0.69,0.072],alloy,[0,0,0],0.034);
            box(phone,[1.29,0.67,0.077],black,[0,0,0],0.035);
            box(phone,[1.22,0.60,0.01],opticalBlack,[0,0,0.042],0.02);
            const panel=mesh(phone,geometry('phone-screen',()=>new T.PlaneGeometry(1.19,0.565)),display,0,0,0.05);panel.castShadow=false;
            box(phone,[0.055,0.2,0.006],black,[-0.59,0,0.057],0.015);
            cylinder(phone,0.013,0.004,opticalBlack,[-0.59,0.025,0.063]);
            box(phone,[0.2,0.015,0.04],alloy,[0.28,0.348,0],0.007);
            box(phone,[0.12,0.015,0.04],alloy,[-0.28,0.348,0],0.007);
            label(group,'NH  STABILIZER',0.18,0.04,[-0.24,-0.40,0.152]);
            return group;
        }

        function createDrone() {
            const group=new T.Group();group.name='Folding camera quadcopter';
            box(group,[0.91,0.36,1.47],lightShell,[0,0.06,0],0.16);
            box(group,[0.82,0.14,1.35],shellSeam,[0,-0.13,-0.02],0.06);
            box(group,[0.68,0.04,0.82],lightShell,[0,0.254,-0.15],0.04);
            for(const x of [-0.35,0.35])box(group,[0.008,0.012,0.85],shellSeam,[x,0.238,-0.14],0.003);
            const batteryButton=cylinder(group,0.065,0.01,shellSeam,[0,0.282,-0.3],'y');
            for(let i=0;i<4;i++)box(group,[0.024,0.008,0.012],greenLED,[-0.066+i*0.044,0.285,-0.15],0.003);
            for(const x of [-0.445,0.445])for(let i=0;i<6;i++)box(group,[0.013,0.022,0.13],black,[x,0.02,-0.33+i*0.065],0.005).rotation.x=-0.3;
            for(const x of [-0.26,0.26]){
                cylinder(group,0.085,0.025,black,[x,0.055,0.733]);
                cylinder(group,0.054,0.029,opticalBlack,[x,0.055,0.751]);
                sphere(group,[0.049,0.049,0.012],glass,[x,0.055,0.773]);
            }
            box(group,[0.28,0.13,0.2],black,[0,-0.25,0.56],0.04);
            const lens=box(group,[0.35,0.27,0.28],graphite,[0,-0.35,0.73],0.07);
            for(const x of [-0.19,0.19])cylinder(group,0.055,0.04,alloy,[x,-0.32,0.66],'x');
            cylinder(group,0.12,0.05,black,[0,-0.35,0.89]);
            torus(group,0.10,0.012,alloy,[0,-0.35,0.921]);
            cylinder(group,0.09,0.008,opticalBlack,[0,-0.35,0.924]);
            sphere(group,[0.087,0.087,0.015],glass,[0,-0.35,0.93]);
            const motors=[];
            for(const [index,[x,z]] of [[-1.03,0.83],[1.03,0.83],[-0.94,-0.89],[0.94,-0.89]].entries()) {
                const start=[Math.sign(x)*0.34,0.03,Math.sign(z)*0.42],end=[x,0.06,z];
                beam(group,start,end,0.13,0.15,lightShell);
                cylinder(group,0.11,0.10,shellSeam,start,'y');
                cylinder(group,0.13,0.16,graphite,[x,0.105,z],'y');
                cylinder(group,0.114,0.022,black,[x,0.193,z],'y');
                cylinder(group,0.073,0.012,alloy,[x,0.206,z],'y');
                if(index<2){beam(group,[x,0.03,z],[x*1.03,-0.29,z+0.04],0.08,0.08,lightShell);box(group,[0.1,0.045,0.13],rubber,[x*1.03,-0.30,z+0.04],0.018);}
                box(group,[0.07,0.025,0.018],index<2?redLED:greenLED,[x,0.095,z+Math.sign(z)*0.13],0.008);
                const prop=new T.Group();prop.position.set(x,0.228,z);group.add(prop);motors.push(prop);
                cylinder(prop,0.07,0.035,black,[0,0,0],'y');
                const bladeShape=new T.Shape();bladeShape.moveTo(0.045,-0.027);bladeShape.bezierCurveTo(0.18,-0.045,0.48,-0.085,0.59,-0.025);bladeShape.quadraticCurveTo(0.64,0.008,0.56,0.027);bladeShape.bezierCurveTo(0.30,0.055,0.17,0.045,0.045,0.027);bladeShape.closePath();
                const bladeGeo=geometry('propeller-blade',()=>new T.ExtrudeGeometry(bladeShape,{depth:0.009,bevelEnabled:false,curveSegments:12}));
                for(let side=0;side<2;side++){
                    const blade=mesh(prop,bladeGeo,rubber);blade.rotation.x=-Math.PI/2;blade.rotation.z=side*Math.PI;
                    box(prop,[0.045,0.007,0.055],alloy,[side?-.55:.55,0.012,0],0.003);
                }
                prop.rotation.y=index*0.7;
            }
            group.userData.motors=motors;
            label(group,'NH  AIR',0.35,0.07,[0,0.08,0.742],{color:'#343a3c',weight:700});
            return group;
        }

        function createRemote() {
            const group=new T.Group();group.name='Integrated-screen drone controller';
            box(group,[1.72,0.96,0.34],lightShell,[0,0,0],0.15);
            box(group,[1.64,0.88,0.1],shellSeam,[0,0,-0.15],0.08);
            for(const x of [-0.64,0.64]){
                sphere(group,[0.25,0.43,0.23],lightShell,[x,-0.28,-0.01]);
                sphere(group,[0.21,0.36,0.07],rubber,[x,-0.29,-0.19]);
                cylinder(group,0.145,0.025,rubber,[x,0.19,0.19]);
                torus(group,0.122,0.013,shellSeam,[x,0.19,0.208]);
                cylinder(group,0.031,0.12,alloy,[x,0.19,0.26]);
                cylinder(group,0.069,0.035,rubber,[x,0.19,0.33]);
                torus(group,0.054,0.009,graphite,[x,0.19,0.353]);
                cylinder(group,0.031,0.007,black,[x,0.19,0.35]);
            }
            box(group,[0.93,0.64,0.018],black,[0,-0.04,0.182],0.04);
            const panel=mesh(group,geometry('remote-display',()=>new T.PlaneGeometry(0.85,0.53)),display,0,-0.035,0.199);panel.castShadow=false;
            cylinder(group,0.04,0.018,black,[-0.36,0.36,0.19]);
            cylinder(group,0.04,0.018,black,[0.36,0.36,0.19]);
            for(let i=0;i<4;i++)sphere(group,[0.008,0.008,0.004],greenLED,[-0.045+i*0.03,0.37,0.18]);
            for(const x of [-0.6,0.6]){
                cylinder(group,0.065,0.22,shellSeam,[x,0.51,-0.06],'x');
                const aerial=box(group,[0.12,0.48,0.07],graphite,[x,0.71,-0.06],0.035);aerial.rotation.z=x>0?-0.15:0.15;
                cylinder(group,0.095,0.055,black,[x,0.43,-0.05],'x');
            }
            label(group,'NH  CONTROL',0.38,0.045,[0,-0.405,0.174],{color:'#454d50'});
            return group;
        }

        const shadowMap=texture(128,128,(ctx,w,h)=>{
            const gradient=ctx.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);gradient.addColorStop(0,'rgba(0,0,0,0.32)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
        });
        const configs=[
            ['camera',createCamera,[0.12,-0.48,-0.055],1.43],
            ['gimbal',createGimbal,[0.06,-0.28,-0.10],1.43],
            ['drone',createDrone,[0.38,-0.38,0.035],1.60],
            ['remote',createRemote,[0.12,-0.28,0.08],1.40]
        ];
        const views=configs.map(([name,factory,pose,scale],index)=>{
            const scene=new T.Scene();scene.environment=environment.texture;
            scene.add(new T.HemisphereLight(0xe3edff,0x676160,0.55));
            const key=new T.DirectionalLight(0xfff3e6,1.8);key.position.set(-3,5,7);key.castShadow=true;
            key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;
            key.shadow.camera.near=0.1;key.shadow.camera.far=20;key.shadow.bias=-0.0003;key.shadow.normalBias=0.012;key.shadow.radius=3;scene.add(key);
            const fill=new T.DirectionalLight(0xd8e8ff,0.75);fill.position.set(4,1,4);scene.add(fill);
            const rim=new T.DirectionalLight(0xffffff,1.4);rim.position.set(1,4,-4);scene.add(rim);
            const model=factory();model.rotation.set(...pose);model.updateMatrixWorld(true);
            const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
            model.position.sub(center);
            const pivot=new T.Group();pivot.add(model);scene.add(pivot);
            const extent=Math.max(size.x,size.y)*0.61;
            const camera=new T.OrthographicCamera(-extent,extent,extent,-extent,0.1,30);camera.position.set(0,0,8);
            const shadow=mesh(scene,geometry('shadow-plane',()=>new T.PlaneGeometry(1,1)),basic('#ffffff',{map:shadowMap,transparent:true,depthWrite:false}),0,-size.y*0.48,-1.8);
            shadow.scale.set(size.x*1.12,size.y*0.2,1);shadow.castShadow=false;
            return {name,scene,model,pivot,camera,element:document.getElementById(`${name}-bubble`),scale,index};
        });
        const pointer={x:0,y:0};
        hero.addEventListener('pointermove',event=>{
            const rect=hero.getBoundingClientRect();
            pointer.x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
            pointer.y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
            invalidate();
        });
        hero.addEventListener('pointerleave',()=>{pointer.x=0;pointer.y=0;invalidate();});
        let width=0,height=0,layouts=[],dirtyLayout=true,last=0,elapsed=0,contextAvailable=true;
        const observer=new ResizeObserver(()=>{dirtyLayout=true;invalidate();});observer.observe(hero);
        function layout() {
            const rect=canvas.getBoundingClientRect();
            if(!rect.width||!rect.height)return;
            width=rect.width;height=rect.height;
            renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(width,height,false);
            layouts=views.map(view=>{
                const b=view.element.getBoundingClientRect();
                const side=b.width*view.scale;
                return {x:b.left+b.width/2-rect.left-side/2,y:height-(b.top+b.height/2-rect.top)-side/2,side};
            });dirtyLayout=false;
        }
        renderFrame=now=>{
            frame=0;
            if(disposed||!contextAvailable||!desktop.matches||!visible||document.hidden)return;
            const dt=Math.min((now-last)/1000||0,0.05);last=now;
            if(!reducedMotion.matches)elapsed+=dt;
            if(dirtyLayout)layout();
            renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();renderer.setScissorTest(true);
            views.forEach((view,index)=>{
                const rect=layouts[index];if(!rect)return;
                const motion=reducedMotion.matches?0:1;
                view.pivot.rotation.y+=(pointer.x*0.10*motion-view.pivot.rotation.y)*0.06;
                view.pivot.rotation.x+=(-pointer.y*0.055*motion-view.pivot.rotation.x)*0.06;
                view.pivot.position.y=Math.sin(elapsed*0.85+index)*0.025*motion;
                if(view.model.userData.motors)view.model.userData.motors.forEach((motor,i)=>{motor.rotation.y+=(i%2?-1:1)*dt*16*motion;});
                renderer.setViewport(rect.x,rect.y,rect.side,rect.side);renderer.setScissor(rect.x,rect.y,rect.side,rect.side);renderer.render(view.scene,view.camera);
            });
            renderer.setScissorTest(false);
            canvas.dataset.gearState='ready';
            if(!reducedMotion.matches)frame=requestAnimationFrame(renderFrame);
        };
        invalidate=()=>{if(!frame&&!disposed&&contextAvailable&&visible&&!document.hidden&&desktop.matches)frame=requestAnimationFrame(renderFrame);};
        document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{last=performance.now();invalidate();}});
        const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else{last=performance.now();invalidate();}},{rootMargin:'80px'});visibility.observe(hero);
        desktop.addEventListener('change',()=>{dirtyLayout=true;if(!desktop.matches){cancelAnimationFrame(frame);frame=0;}else invalidate();});
        reducedMotion.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;invalidate();});
        canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextAvailable=false;cancelAnimationFrame(frame);frame=0;canvas.dataset.gearState='context-lost';});
        canvas.addEventListener('webglcontextrestored',()=>{contextAvailable=true;dirtyLayout=true;invalidate();});
        window.addEventListener('pagehide',event=>{
            if(event.persisted)return;
            disposed=true;cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();
            views.forEach(view=>view.scene.traverse(obj=>{if(obj.shadow?.map)obj.shadow.map.dispose();}));
            resources.forEach(resource=>resource.dispose?.());renderer.dispose();
        });
        invalidate();
    }
    desktop.addEventListener('change',initialize);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
