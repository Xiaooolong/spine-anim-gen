import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Spine, AtlasAttachmentLoader, SkeletonJson, SpineTexture, TextureAtlas } from '@esotericsoftware/spine-pixi-v8'

export default function SpinePixiPreview({ 
  animUrl, 
  localFiles 
}: { 
  animUrl?: string; 
  localFiles?: File[] 
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const spineRef = useRef<Spine | null>(null)
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState('Initializing...')
  const [animations, setAnimations] = useState<string[]>([])
  const [currentAnim, setCurrentAnim] = useState('')

  useEffect(() => {
    let mounted = true
    const createdObjectUrls: string[] = []
    const createObjectUrl = (file: File) => {
      const url = URL.createObjectURL(file)
      createdObjectUrls.push(url)
      return url
    }

    const init = async () => {
      if (!containerRef.current) return
      
      // Cleanup previous app
      if (appRef.current) {
        appRef.current.destroy({ removeView: true })
        appRef.current = null
        spineRef.current = null
      }

      const app = new PIXI.Application()
      await app.init({ 
        width: 800, 
        height: 600, 
        background: '#f9fafb', 
        antialias: true,
        resolution: window.devicePixelRatio || 1
      })
      
      if (!mounted) { app.destroy(); return }
      containerRef.current.appendChild(app.canvas)
      appRef.current = app

      // Grid
      const grid = new PIXI.Graphics()
      grid.stroke({ width: 1, color: 0xeeeeee })
      for(let i=0; i<=800; i+=50) { grid.moveTo(i, 0).lineTo(i, 600) }
      for(let i=0; i<=600; i+=50) { grid.moveTo(0, i).lineTo(800, i) }
      app.stage.addChild(grid)

      const mainContainer = new PIXI.Container()
      app.stage.addChild(mainContainer)
      mainContainer.position.set(400, 300)

      try {
        setError('')

        let spineData: any = null

        if (localFiles && localFiles.length > 0) {
          const jsonFile = localFiles.find(f => f.name.toLowerCase().endsWith('.json'))
          const atlasFile = localFiles.find(f => f.name.toLowerCase().endsWith('.atlas'))
          const pngFiles = localFiles.filter(f => f.name.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/i))

          if (!jsonFile) throw new Error('缺少 skeleton .json 文件')
          if (!atlasFile) throw new Error('缺少 .atlas 文件')
          if (pngFiles.length === 0) throw new Error('缺少贴图文件 (.png/.jpg/.webp)')

          const atlasText = await atlasFile.text()
          const atlas = new TextureAtlas(atlasText)

          const normalize = (s: string) => s.replace(/\\/g, '/').toLowerCase()
          const byName = new Map<string, File>()
          for (const f of pngFiles) byName.set(normalize(f.name), f)

          for (const page of atlas.pages) {
            const pageName = normalize(page.name)
            const baseName = pageName.split('/').at(-1) || pageName

            const matched =
              byName.get(pageName) ||
              byName.get(baseName) ||
              (pngFiles.length === 1 ? pngFiles[0] : undefined)

            if (!matched) {
              throw new Error(`atlas 引用贴图未找到: ${page.name}`)
            }

            // Pixi v8 Assets.load with blob URL often fails because it doesn't know the type.
            // We load it manually using Image/ImageBitmap.
            const texture = await (async () => {
              if (globalThis.createImageBitmap) {
                const bitmap = await createImageBitmap(matched)
                return PIXI.Texture.from(bitmap)
              } else {
                return new Promise<PIXI.Texture>((res, rej) => {
                  const img = new Image()
                  img.onload = () => res(PIXI.Texture.from(img))
                  img.onerror = () => rej(new Error(`贴图解析失败: ${matched.name}`))
                  img.src = createObjectUrl(matched)
                })
              }
            })().catch(e => {
              throw new Error(`贴图加载失败: ${matched.name}`)
            })
            
            if (!(texture as any)?.source) {
              throw new Error(`贴图加载失败: ${matched.name}`)
            }
            page.setTexture(SpineTexture.from((texture as any).source))
          }

          const skeletonJson = JSON.parse(await jsonFile.text())
          const atlasLoader = new AtlasAttachmentLoader(atlas)
          const jsonLoader = new SkeletonJson(atlasLoader)
          spineData = jsonLoader.readSkeletonData(skeletonJson)
        } else {
          const finalUrl = animUrl || ''
          if (!finalUrl) return

          const cacheBust = Date.now()
          const loadUrl = `${finalUrl}?t=${cacheBust}`

          console.log('[SpinePixiPreview] Loading:', loadUrl)

          const resource = await PIXI.Assets.load({
            src: loadUrl,
            data: { spineSkeletonScale: 1.0 }
          })

          if (!resource) throw new Error('资源加载失败')

          const maybeSpineData = (resource as any).spineData
          if (maybeSpineData) {
            spineData = maybeSpineData
          } else {
            const atlasUrl = finalUrl.replace(/\.json(\?.*)?$/i, '.atlas')
            const atlasAsset = await PIXI.Assets.load(`${atlasUrl}?t=${Date.now()}`)
            const atlasLoader = new AtlasAttachmentLoader(atlasAsset)
            const jsonLoader = new SkeletonJson(atlasLoader)
            spineData = jsonLoader.readSkeletonData(resource)
          }
        }

        if (!spineData) throw new Error('无效的 Spine 数据')

        const spineAnim = new Spine(spineData)
        mainContainer.addChild(spineAnim)
        spineRef.current = spineAnim

        // Center and Scale
        const bounds = spineAnim.getBounds()
        spineAnim.position.set(-bounds.x - bounds.width/2, -bounds.y - bounds.height/2)
        let scale = Math.min(700 / bounds.width, 500 / bounds.height)
        if (scale < 0.01 || scale > 100) scale = 1.0
        mainContainer.scale.set(scale)

        // Get all animations
        const anims = spineAnim.skeleton.data.animations.map(a => a.name)
        setAnimations(anims)

        // Find best animation to play
        const priorityAnims = ['video_retarget_v2', 'video_retarget', 'animation', 'walk', 'idle']
        let activeAnim = priorityAnims.find(name => spineAnim.skeleton.data.findAnimation(name)) || (anims.length > 0 ? anims[0] : '')
        
        if (activeAnim) {
            spineAnim.state.setAnimation(0, activeAnim, true)
            setCurrentAnim(activeAnim)
        }

        // --- Interaction ---
        app.stage.eventMode = 'static'
        app.stage.hitArea = app.screen
        let isDragging = false
        let lastPos = { x: 0, y: 0 }
        
        app.stage.on('pointerdown', (e) => {
          isDragging = true
          lastPos = { x: e.global.x, y: e.global.y }
        })
        
        app.stage.on('pointermove', (e) => {
          if (isDragging) {
            mainContainer.position.x += e.global.x - lastPos.x
            mainContainer.position.y += e.global.y - lastPos.y
            lastPos = { x: e.global.x, y: e.global.y }
          }
        })
        
        app.stage.on('pointerup', () => isDragging = false)
        app.stage.on('pointerupoutside', () => isDragging = false)
        
        const onWheel = (e: WheelEvent) => {
          e.preventDefault()
          const direction = e.deltaY > 0 ? 0.9 : 1.1
          mainContainer.scale.set(Math.max(0.01, Math.min(mainContainer.scale.x * direction, 50)))
        }
        app.canvas.addEventListener('wheel', onWheel)

        app.ticker.add(() => {
            spineAnim.update(app.ticker.deltaTime / 60)
            const track = spineAnim.state.getCurrent(0)
            setDebugInfo(`Scale: ${mainContainer.scale.x.toFixed(2)} | Anim: ${track?.animation.name || 'None'} | Time: ${track?.trackTime.toFixed(2) || '0'}`)
        })

      } catch (err) {
        console.error(err)
        setError('加载失败: ' + (err as Error).message)
      }
    }

    init()

    return () => {
      mounted = false
      for (const u of createdObjectUrls) {
        try { URL.revokeObjectURL(u) } catch {}
      }
      if (appRef.current) {
         appRef.current.destroy({ removeView: true })
         appRef.current = null
      }
    }
  }, [animUrl, localFiles])

  const playAnimation = (name: string) => {
    if (spineRef.current) {
      spineRef.current.state.setAnimation(0, name, true)
      setCurrentAnim(name)
    }
  }

  return (
    <div className="relative border rounded overflow-hidden bg-gray-100 group">
       <div ref={containerRef} style={{ width: '100%', height: '500px' }} />
       {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-white/80 p-4 text-center">{error}</div>}
       <div className="absolute top-2 left-2 text-xs font-mono text-blue-600 bg-white/90 px-2 py-1 rounded z-10 pointer-events-none select-none">{debugInfo}</div>
       <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded pointer-events-none select-none">Scroll to Zoom / Drag to Pan</div>
       
       {/* Animation List Panel */}
       <div className="absolute top-2 right-2 bottom-2 w-48 bg-white/90 backdrop-blur-sm border rounded-lg shadow-lg flex flex-col overflow-hidden transition-transform translate-x-[calc(100%-8px)] hover:translate-x-0 z-20">
           <div className="p-2 border-b bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
               <span>Animations ({animations.length})</span>
               <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
           </div>
           <div className="flex-1 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
               {animations.map(name => (
                   <button 
                       key={name}
                       onClick={() => playAnimation(name)}
                       className={`
                           w-full text-left px-3 py-2 text-xs rounded transition-all truncate
                           ${currentAnim === name 
                               ? 'bg-blue-600 text-white font-medium shadow-sm' 
                               : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'}
                       `}
                       title={name}
                   >
                       {name}
                   </button>
               ))}
               {animations.length === 0 && (
                   <div className="p-4 text-center text-xs text-gray-400">No animations found</div>
               )}
           </div>
           <div className="p-2 border-t bg-gray-50 flex gap-1">
               <button 
                   onClick={() => spineRef.current && (spineRef.current.state.timeScale = 0)}
                   className="flex-1 p-1 bg-white border rounded text-[10px] hover:bg-gray-100"
               >Pause</button>
               <button 
                   onClick={() => spineRef.current && (spineRef.current.state.timeScale = 1)}
                   className="flex-1 p-1 bg-white border rounded text-[10px] hover:bg-gray-100"
               >Resume</button>
           </div>
       </div>
    </div>
  )
}
