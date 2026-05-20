// Canned API responses for unit tests. Hand-shaped to match the real wire
// format of each backend just closely enough to exercise the parser.

export const nyaaRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:nyaa="https://nyaa.si/xmlns/nyaa">
<channel>
<title>Nyaa - "One Piece 01" - Torrent File RSS</title>
<item>
<title>[SubsPlease] One Piece - 01 (1080p) [ABCD1234].mkv</title>
<link>https://nyaa.si/download/1234567.torrent</link>
<guid isPermaLink="true">https://nyaa.si/view/1234567</guid>
<pubDate>Sat, 20 Apr 2024 12:00:00 -0000</pubDate>
<nyaa:seeders>123</nyaa:seeders>
<nyaa:leechers>4</nyaa:leechers>
<nyaa:downloads>5000</nyaa:downloads>
<nyaa:infoHash>aabbccddeeff00112233445566778899aabbccdd</nyaa:infoHash>
<nyaa:categoryId>1_2</nyaa:categoryId>
<nyaa:category>Anime - English-translated</nyaa:category>
<nyaa:size>1.4 GiB</nyaa:size>
<nyaa:comments>0</nyaa:comments>
<nyaa:trusted>Yes</nyaa:trusted>
<nyaa:remake>No</nyaa:remake>
<description><![CDATA[some description]]></description>
</item>
<item>
<title>[BadGroup] One Piece - 01 [Remake].mkv</title>
<link>https://nyaa.si/download/1234568.torrent</link>
<guid isPermaLink="true">https://nyaa.si/view/1234568</guid>
<pubDate>Sat, 20 Apr 2024 13:00:00 -0000</pubDate>
<nyaa:seeders>1</nyaa:seeders>
<nyaa:leechers>0</nyaa:leechers>
<nyaa:downloads>2</nyaa:downloads>
<nyaa:infoHash>1111111111111111111111111111111111111111</nyaa:infoHash>
<nyaa:categoryId>1_2</nyaa:categoryId>
<nyaa:size>500.0 MiB</nyaa:size>
<nyaa:trusted>No</nyaa:trusted>
<nyaa:remake>Yes</nyaa:remake>
</item>
</channel>
</rss>`

export const acgripRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>acg.rip</title>
<item>
<title>[Group] Show - 01 [1080p].mkv</title>
<link>https://acg.rip/t/999.html</link>
<guid>https://acg.rip/t/999.html</guid>
<pubDate>Sat, 20 Apr 2024 12:00:00 +0000</pubDate>
<enclosure url="https://acg.rip/t/999.torrent" length="1500000000" type="application/x-bittorrent"/>
<description>Size: 1.4 GB</description>
</item>
</channel>
</rss>`

export const newznabJson = JSON.stringify({
  channel: {
    item: [
      {
        title: '[Group] One Piece - 01 [1080p].mkv',
        guid: 'guid-1',
        link: 'https://api.example.com/nzb/abc',
        pubDate: 'Sat, 20 Apr 2024 12:00:00 +0000',
        size: '1500000000'
      }
    ]
  }
})

export const animetoshoByHashJson = JSON.stringify({
  id: 12345,
  title: '[SubsPlease] One Piece - 01 (1080p)',
  nzb_url: 'https://animetosho.org/storage/nzbs/abc.nzb',
  info_hash: 'aabbccddeeff00112233445566778899aabbccdd'
})

export const animetoshoByEidJson = JSON.stringify([
  {
    title: '[SubsPlease] One Piece - 01 (1080p)',
    torrent_name: '[SubsPlease] One Piece - 01 (1080p).torrent',
    torrent_url: 'https://animetosho.org/storage/torrent/abc.torrent',
    magnet_uri: 'magnet:?xt=urn:btih:aabbccddeeff00112233445566778899aabbccdd&dn=test',
    seeders: 100,
    leechers: 3,
    torrent_downloaded_count: 200,
    info_hash: 'aabbccddeeff00112233445566778899aabbccdd',
    total_size: 1_500_000_000,
    anidb_fid: 1,
    timestamp: 1_700_000_000,
    num_files: 1
  }
])

export const subspleaseJson = JSON.stringify({
  '1234': {
    show: 'One Piece',
    episode: '1',
    release_date: '04/20/2024',
    downloads: [
      { res: '480', magnet: 'magnet:?xt=urn:btih:aabbccddeeff00112233445566778899aabbccdd&xl=600000000' },
      { res: '720', magnet: 'magnet:?xt=urn:btih:bbccddeeff00112233445566778899aabbccddee&xl=1000000000' },
      { res: '1080', magnet: 'magnet:?xt=urn:btih:ccddeeff00112233445566778899aabbccddeef0&xl=1500000000' }
    ]
  },
  '5678': {
    show: 'One Piece',
    episode: 'Batch',
    release_date: '04/19/2024',
    downloads: [
      { res: '1080', magnet: 'magnet:?xt=urn:btih:ddeeff00112233445566778899aabbccddeef011&xl=15000000000' }
    ]
  }
})

export const seadexJson = JSON.stringify({
  items: [
    {
      expand: {
        trs: [
          {
            // Multi-file batch — passes SeaDex's `files.length !== 1` filter
            // (which kicks in when episodeCount > 1 i.e. TV series).
            infoHash: 'aabbccddeeff00112233445566778899aabbccdd',
            releaseGroup: 'BestGroup',
            isBest: true,
            dualAudio: false,
            created: '2024-04-20T12:00:00Z',
            files: [
              { name: '[BestGroup] One Piece - 01.mkv', length: 1_500_000_000 },
              { name: '[BestGroup] One Piece - 02.mkv', length: 1_500_000_000 }
            ]
          },
          {
            infoHash: '<redacted>',
            releaseGroup: 'SecretGroup',
            isBest: false,
            dualAudio: false,
            created: '2024-04-20T12:00:00Z',
            files: [
              { name: 'redacted-01.mkv', length: 100 },
              { name: 'redacted-02.mkv', length: 100 }
            ]
          }
        ]
      }
    }
  ]
})

export const nzbXml = `<?xml version="1.0" encoding="iso-8859-1" ?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
  <file poster="poster@home.invalid" date="1700000000" subject="[Group] One Piece - 01 [1080p].mkv (1/100)">
    <groups><group>alt.binaries.example</group></groups>
    <segments>
      <segment bytes="500000" number="1">aaa@example</segment>
    </segments>
  </file>
  <file poster="poster@home.invalid" date="1700000000" subject="[Group] One Piece - 01 [1080p].mkv (2/100)">
    <groups><group>alt.binaries.example</group></groups>
    <segments>
      <segment bytes="500000" number="2">bbb@example</segment>
    </segments>
  </file>
</nzb>`

// New NekoBT flow (post-rewrite): one search call resolves tvdbid→media; a
// second search call (now with media_id) returns torrents.
export const nekobtMediaSearchJson = JSON.stringify({
  data: {
    media: {
      id: 'media-id-abc',
      episodes: [
        { id: 'ep-id-01', tvdbId: 11111, episode: 1 }
      ]
    }
  }
})

export const nekobtSearchJson = JSON.stringify({
  data: {
    results: [
      {
        id: 1099511627776,
        title: '[Group] One Piece - 01 [1080p].mkv',
        seeders: '50',
        leechers: '2',
        completed: '500',
        infohash: 'aabbccddeeff00112233445566778899aabbccdd',
        filesize: '1500000000',
        level: 1,
        batch: false,
        uploaded_at: '2024-04-20T12:00:00Z'
      }
    ]
  }
})
