{
  "targets": [
    {
      "target_name": "kstack_citation_fs_native",
      "sources": ["src/citation_fs_native.cc"],
      "defines": ["NAPI_VERSION=8"],
      "cflags_cc": ["-std=c++17", "-fno-exceptions"]
    }
  ]
}
