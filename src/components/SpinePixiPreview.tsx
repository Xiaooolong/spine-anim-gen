import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Spine, AtlasAttachmentLoader, SkeletonJson } from '@esotericsoftware/spine-pixi-v8'

// Ensure the loader is registered (side-effect import)
// Note: In some setups explicit registration might be needed, but usually just importing the package is enough.
// We might need to import the loader specifically if it doesn't auto-register.
// Usually: import '@esotericsoftware/spine-pixi-v8'; is enough.

export default function SpinePixiPreview({ animUrl }: { animUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState('Initializing...')

  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!containerRef.current) return
      
      // Cleanup previous app if exists (shouldn't happen due to deps, but safety first)
      if (appRef.current) {
        appRef.current.destroy({ removeView: true })
        appRef.current = null
      }

      const app = new PIXI.Application()
      await app.init({ width: 800, height: 600, background: '#e5e7eb', antialias: true })
      
      if (!mounted) { app.destroy(); return }
      containerRef.current.appendChild(app.canvas)
      appRef.current = app

      // Grid
      const grid = new PIXI.Graphics()
      grid.stroke({ width: 1, color: 0xcccccc })
      grid.moveTo(400, 0).lineTo(400, 600)
      grid.moveTo(0, 300).lineTo(800, 300)
      app.stage.addChild(grid)

      const mainContainer = new PIXI.Container()
      app.stage.addChild(mainContainer)
      
      // Default transform
      mainContainer.position.set(400, 300)

      try {
        // Load Spine Data
        // We append a timestamp to avoid caching issues during development iterations
        const cacheBust = Date.now()
        const cacheBustUrl = `${animUrl}?t=${cacheBust}`
        
        console.log('[SpinePixiPreview] Loading:', cacheBustUrl)
        
        // Unload from cache if exists to force reload
        if (PIXI.Assets.cache.has(cacheBustUrl)) {
             await PIXI.Assets.unload(cacheBustUrl)
        }
        
        // Explicitly load the Atlas first to ensure we can debug it? 
        // No, Pixi handles it. But let's try to load Atlas manually to verify content if needed.
        
        // PIXI Assets loader should handle .json and finding .atlas automatically
        const resource = await PIXI.Assets.load({
            src: cacheBustUrl,
            data: { spineSkeletonScale: 1.0 }
        })
        
        if (!resource) {
            throw new Error('Failed to load resource')
        }

        let spineData = resource.spineData
        
        // Fallback: If loader returned raw JSON instead of SpineData
        if (!spineData && resource.skeleton) {
             console.log('SpinePixiPreview: Manual fallback loading')
             const atlasUrl = animUrl.replace('.json', '.atlas')
             const atlasAsset = await PIXI.Assets.load(`${atlasUrl}?t=${Date.now()}`)
             
             // Create a simple atlas attachment loader
             const atlasLoader = new AtlasAttachmentLoader(atlasAsset)
             const jsonLoader = new SkeletonJson(atlasLoader)
             spineData = jsonLoader.readSkeletonData(resource)
        }

        if (!spineData) {
            throw new Error('Invalid Spine data loaded (no spineData)')
        }

        const spineAnim = new Spine(spineData)
        mainContainer.addChild(spineAnim)

        // Auto-fit logic
        const bounds = spineAnim.getBounds()
        const w = bounds.width
        const h = bounds.height
        
        // Center the spine within the container
        // Spine origin is usually at the feet (0,0), but bounds might be offset
        spineAnim.position.set(-bounds.x - w/2, -bounds.y - h/2)

        let scale = Math.min(600 / w, 400 / h)
        if (scale < 0.01 || scale > 100) scale = 0.5
        mainContainer.scale.set(scale)

        // Animation
        const anims = spineAnim.skeleton.data.animations
        console.log('[SpinePixiPreview] Available animations:', anims.map(a => a.name))
        
        let activeAnim = ''
        const availableAnims = spineAnim.skeleton.data.animations.map(a => a.name)
        console.log('[SpinePixiPreview] Available animations:', availableAnims)

        if (spineAnim.skeleton.data.findAnimation('video_retarget_v2')) {
            activeAnim = 'video_retarget_v2'
        } else if (spineAnim.skeleton.data.findAnimation('video_retarget')) {
            activeAnim = 'video_retarget'
        } else if (spineAnim.skeleton.data.findAnimation('animation')) {
            activeAnim = 'animation'
        } else if (anims.length > 0) {
            activeAnim = anims[0].name
        }
        
        if (activeAnim) {
            console.log('[SpinePixiPreview] Playing animation:', activeAnim)
            spineAnim.state.setAnimation(0, activeAnim, true)
            setDebugInfo(prev => `${prev} | Anim: ${activeAnim}`)
        } else {
            console.warn('[SpinePixiPreview] No animation found')
            setDebugInfo(prev => `${prev} | No Anim`)
        }

        // --- Interactivity (Pan/Zoom) ---
        app.stage.eventMode = 'static'
        app.stage.hitArea = app.screen
        
        let isDragging = false
        let lastPos = { x: 0, y: 0 }
        
        app.stage.on('pointerdown', (e) => {
          isDragging = true
          lastPos = { x: e.global.x, y: e.global.y }
          
          // Debug: Click to rotate head
          // const head = spineAnim.skeleton.findBone('head')
          // if (head) {
          //     head.rotation += 45
          //     console.log('Manual head rotation applied')
          // }
        })
        
        app.stage.on('pointermove', (e) => {
          if (isDragging) {
            const dx = e.global.x - lastPos.x
            const dy = e.global.y - lastPos.y
            mainContainer.position.x += dx
            mainContainer.position.y += dy
            lastPos = { x: e.global.x, y: e.global.y }
            updateDebug()
          }
        })
        
        app.stage.on('pointerup', () => { isDragging = false })
        app.stage.on('pointerupoutside', () => { isDragging = false })
        
        const onWheel = (e: WheelEvent) => {
          e.preventDefault()
          const zoomFactor = 1.1
          const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor
          const newScale = Math.max(0.01, Math.min(mainContainer.scale.x * direction, 50.0))
          mainContainer.scale.set(newScale)
          updateDebug()
        }
        app.canvas.addEventListener('wheel', onWheel)

        const updateDebug = () => {
           let info = `Scale: ${mainContainer.scale.x.toFixed(2)} | Pos: ${mainContainer.position.x.toFixed(0)},${mainContainer.position.y.toFixed(0)}`
           const head = spineAnim.skeleton.findBone('head')
           const hip = spineAnim.skeleton.findBone('hip')
           if (head) info += ` | HeadRot: ${head.rotation.toFixed(1)}`
           if (hip) info += ` | HipX: ${hip.x.toFixed(1)}`
           
           // Check active track
            const track = spineAnim.state.getCurrent(0)
            if (track) {
                info += ` | Time: ${track.trackTime.toFixed(2)}`
                info += ` | Anim: ${track.animation.name}`
            } else {
                info += ` | No Track`
            }
            
            setDebugInfo(info)
        }
        updateDebug()

        // Ticker
        app.ticker.add(() => {
            spineAnim.update(app.ticker.deltaTime / 60)
            
            // DEBUG: Manually rotate head to prove renderer is working
            // If the head spins, the renderer is fine, and the issue is the animation data not being applied
            // or being overwritten.
            // const head = spineAnim.skeleton.findBone('head')
            // if (head) {
                 // Uncomment the line below to test manual rotation
                 // head.rotation += 2 
            // }

            updateDebug() 
        })

      } catch (err) {
        console.error(err)
        setError('加载动画失败: ' + (err as Error).message)
      }
    }

    init()

    return () => {
      mounted = false
      if (appRef.current) {
         appRef.current.destroy({ removeView: true })
         appRef.current = null
      }
    }
  }, [animUrl])

  return (
    <div className="relative border rounded overflow-hidden bg-gray-100">
       <div ref={containerRef} style={{ width: '100%', height: '400px' }} />
       {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-white/80 p-4 text-center">{error}</div>}
       <div className="absolute top-2 left-2 text-xs font-mono text-blue-600 bg-white/90 px-2 py-1 rounded z-10 pointer-events-none select-none">{debugInfo}</div>
       <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded pointer-events-none select-none">Scroll to Zoom / Drag to Pan</div>
       <div className="absolute top-2 right-2 flex flex-col gap-2">
           <button className="bg-white/90 px-2 py-1 text-xs rounded border hover:bg-gray-100" onClick={() => {
               if (appRef.current && appRef.current.stage.children[1] && (appRef.current.stage.children[1] as any).children[0]) {
                   const s = (appRef.current.stage.children[1] as any).children[0];
                   s.state.setAnimation(0, 'video_retarget_v2', true);
               }
           }}>Play: Retarget V2</button>
           <button className="bg-white/90 px-2 py-1 text-xs rounded border hover:bg-gray-100" onClick={() => {
               if (appRef.current && appRef.current.stage.children[1] && (appRef.current.stage.children[1] as any).children[0]) {
                   const s = (appRef.current.stage.children[1] as any).children[0];
                   if (s.skeleton.data.findAnimation('walk')) s.state.setAnimation(0, 'walk', true);
                   else alert('No walk anim found');
               }
           }}>Play: Walk</button>
           <button className="bg-white/90 px-2 py-1 text-xs rounded border hover:bg-gray-100" onClick={() => {
               if (appRef.current && appRef.current.stage.children[1] && (appRef.current.stage.children[1] as any).children[0]) {
                   const s = (appRef.current.stage.children[1] as any).children[0];
                   if (s.skeleton.data.findAnimation('run')) s.state.setAnimation(0, 'run', true);
                   else alert('No run anim found');
               }
           }}>Play: Run</button>
       </div>
    </div>
  )
}
