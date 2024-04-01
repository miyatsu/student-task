#include <iostream>
using namespace std;

// author:Liu-3237094548@qq.com-2024.3.28
// diskCount: Number of disks to move
// sourcePole: The pole from which disks are moved ('A')
// destinationPole: The pole to which disks are moved ('C')
// auxiliaryPole: The pole used as an aid to move disks ('B')

void hanoi(int diskCount, char sourcePole, char destinationPole, char auxiliaryPole)
{
    // Base case: if there's only one disk, move it directly from source to destination
    if (diskCount == 1)
    {
        cout << "移动盘 1 由 " << sourcePole << " -> " << destinationPole << endl;
    }
    else
    {
        // Move n-1 disks from source to auxiliary, using destination as a temporary pole
        hanoi(diskCount - 1, sourcePole, auxiliaryPole, destinationPole);
        // Move the nth disk from source to destination
        cout << "移动盘 " << diskCount << " 由 " << sourcePole << " -> " << destinationPole << endl;
        // Move the n-1 disks from auxiliary to destination, using source as a temporary pole
        hanoi(diskCount - 1, auxiliaryPole, destinationPole, sourcePole);
    }
}

int main(void) 
{
    int diskCount; // The total number of disks to move
    cout << "请输入圆盘的总数量: ";
    cin >> diskCount;
    // Check for valid input
    if (diskCount <= 0)
    {
        cout << "无效的数量，请输入一个正数。" << endl;
        return 1; // Return an error code
    }

    hanoi(diskCount, 'A', 'C', 'B');
    return 0;
}
