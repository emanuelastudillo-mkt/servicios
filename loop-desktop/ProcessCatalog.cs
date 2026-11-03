using System.Diagnostics;
using System.Runtime.InteropServices;

namespace SeisDesktop;
internal static class ProcessCatalog
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct ProcessEntry
    {
        public uint Size, Usage, ProcessId; public IntPtr DefaultHeap;
        public uint ModuleId, Threads, ParentId; public int Priority; public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string Exe;
    }
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint id);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr handle, ref ProcessEntry entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr handle, ref ProcessEntry entry);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    public static Dictionary<int, (int Parent, string Name)> Snapshot()
    {
        var result = new Dictionary<int, (int, string)>();
        var handle = CreateToolhelp32Snapshot(2, 0); if (handle == new IntPtr(-1)) return result;
        try {
            var entry = new ProcessEntry { Size = (uint)Marshal.SizeOf<ProcessEntry>(), Exe = "" };
            if (Process32FirstW(handle, ref entry)) do { result[(int)entry.ProcessId] = ((int)entry.ParentId, entry.Exe); } while (Process32NextW(handle, ref entry));
        } finally { CloseHandle(handle); }
        return result;
    }
    public static bool IsOurTree(int id, Dictionary<int, (int Parent, string Name)> map)
    {
        var visited = new HashSet<int>();
        while (visited.Add(id) && id > 0) { if (id == Environment.ProcessId) return true; if (!map.TryGetValue(id, out var item)) break; id = item.Parent; }
        return false;
    }
    public static int AppRoot(int id, Dictionary<int, (int Parent, string Name)> map)
    {
        var visited = new HashSet<int>();
        while (visited.Add(id) && map.TryGetValue(id, out var item) && map.TryGetValue(item.Parent, out var parent) && item.Name.Equals(parent.Name, StringComparison.OrdinalIgnoreCase)) id = item.Parent;
        return id;
    }
}
