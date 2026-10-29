// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { embedUrlFor, entrance, parseSoundCloudUrl, startEntranceMusic, stopEntranceMusic } from '@/audio/entrance'

describe('SoundCloud link parsing', () => {
  it('accepts album, playlist and track links and normalises them to https', () => {
    expect(parseSoundCloudUrl('https://soundcloud.com/some-artist/sets/my-album')).toBe('https://soundcloud.com/some-artist/sets/my-album')
    expect(parseSoundCloudUrl('  http://www.soundcloud.com/a/b  ')).toBe('https://www.soundcloud.com/a/b')
    expect(parseSoundCloudUrl('https://m.soundcloud.com/a/sets/b?si=xyz')).toBe('https://m.soundcloud.com/a/sets/b?si=xyz')
    expect(parseSoundCloudUrl('https://on.soundcloud.com/AbCd123')).toBe('https://on.soundcloud.com/AbCd123')
    expect(parseSoundCloudUrl('soundcloud.com/some-artist/sets/my-album')).toBe('https://soundcloud.com/some-artist/sets/my-album')
  })

  it('refuses everything else: other sites, look-alike hosts, odd schemes, credentials, ports, the bare homepage', () => {
    for (const bad of [
      '', 'hello', 'javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'ftp://soundcloud.com/a/b',
      'https://evil.example/soundcloud.com/a/b', 'https://soundcloud.com.evil.example/a/b', 'https://notsoundcloud.com/a/b',
      'https://soundcloud.com@evil.example/a/b', 'https://user:pw@soundcloud.com/a/b', 'https://soundcloud.com:8443/a/b',
      'https://soundcloud.com/', 'https://soundcloud.com', 'evil.example/soundcloud.com/a/b', '//evil.example/a/b', 'soundcloud.com.evil.example/a/b', 'https://spotify.com/album/1',
    ]) expect(parseSoundCloudUrl(bad), bad).toBeNull()
  })
})

describe('the entrance player frame', () => {
  afterEach(() => stopEntranceMusic())

  it('embeds only SoundCloud’s own player, with the album as an encoded parameter', () => {
    const url = new URL(embedUrlFor('https://soundcloud.com/a/sets/b?x=1&y=2'))
    expect(url.origin + url.pathname).toBe('https://w.soundcloud.com/player/')
    expect(url.searchParams.get('url')).toBe('https://soundcloud.com/a/sets/b?x=1&y=2')
    expect(url.searchParams.get('auto_play')).toBe('true')
  })

  it('creates one hidden, titled frame for a good link and nothing for a bad one', () => {
    expect(startEntranceMusic('https://evil.example/x/y', 0.5)).toBe(false)
    expect(document.querySelectorAll('iframe')).toHaveLength(0)
    expect(entrance.active).toBe(false)

    expect(startEntranceMusic('https://soundcloud.com/a/sets/b', 0.5)).toBe(true)
    const frames = document.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect(frames[0]!.src.startsWith('https://w.soundcloud.com/player/?')).toBe(true)
    expect(frames[0]!.getAttribute('allow')).toBe('autoplay')
    expect(frames[0]!.title).toMatch(/SoundCloud/)
    expect(entrance).toMatchObject({ active: true, playing: true })

    startEntranceMusic('https://soundcloud.com/a/sets/c', 0.5) // restarting replaces the frame, never stacks
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    stopEntranceMusic()
    expect(document.querySelectorAll('iframe')).toHaveLength(0)
    expect(entrance.active).toBe(false)
  })
})
