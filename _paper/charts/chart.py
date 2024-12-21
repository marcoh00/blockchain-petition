#!/usr/bin/env python3

from matplotlib.patches import PathPatch
from matplotlib.rcsetup import cycler
from matplotlib.textpath import TextPath
import numpy as np
import matplotlib
import matplotlib.ticker as ticker
import matplotlib.pyplot as plt

def avg_gas_price(filename, filter):
    with open(filename, 'r') as fp:
        wei = []
        first = True
        for line in fp.readlines():
            if first:
                first = False
                continue
            parts = line.split(',')
            parts[0] = parts[0][1:-1]
            parts[1] = int(parts[1][1:-1])
            parts[2] = int(parts[2][1:-2])
            if filter(parts):
                wei.append(parts[2])
        return wei

bar_width = 0.15
fig, ax = plt.subplots(layout='constrained') 

create = [775454, 855820, 657387, 772340, 772494]
sign = [90395, 525238, 330368, 2165940, 137234]
approve = [50002, 79306, 129891, 0, 0]

# 4004,24 2024-12-16
eth_price = 4000

# Block 21411883
#eth_gas = 10.909095097 + 0.1

eth_gas_2024 = avg_gas_price("export-AvgGasPrice.csv", lambda parts: parts[0].split("/")[2] == "2024")

# Block 129357473
#op_gas = 0.000058466 + 0.0005
op_gas_2024 = avg_gas_price("export-AvgGasPrice-op.csv", lambda parts: parts[0].split("/")[2] == "2024")

eth_gas = np.median(eth_gas_2024)
op_gas = np.median(op_gas_2024)

print(f"Median Gas Prices. ETH: {eth_gas:.2f}, OP: {op_gas:.2f}")

gwei = 10**-9
wei = 10**-18

print(f"ETH Gas (Gwei): {eth_gas * gwei}. OP (Gwei): {op_gas * gwei}")


# Say, "the default sans-serif font is COMIC SANS"
matplotlib.rcParams['font.sans-serif'] = "Nimbus Sans"
# Then, "ALWAYS use sans-serif fonts"
matplotlib.rcParams['font.family'] = "sans-serif"
(c1, c2, c25, c3, c4, c5, c6, c7, c8, c9) = ("#000000", "#191919", "#3c3c3c" , "#323232", "#4b4b4b", "#646464", "#7d7d7d", "#969696", "#afafaf", "#c8c8c8")
matplotlib.rcParams['hatch.linewidth'] = 0.3

eth_create = [x * eth_gas * eth_price * wei for x in create]
eth_sign = [x * eth_gas * eth_price * wei for x in sign]
eth_approve = [x * eth_gas * eth_price * wei for x in approve]
op_create = [x * op_gas * eth_price * wei for x in create]
op_sign = [x * op_gas * eth_price * wei for x in sign]
op_approve = [x * op_gas * eth_price * wei for x in approve]

print(f"ETH Sign: {eth_sign}")
print(f"OP Sign: {op_sign}")

#fig, axs = plt.subplots(2)

pos1 = np.arange(len(create))
pos2 = [x + bar_width for x in pos1]
pos3 = [x + bar_width for x in pos2]
pos4 = [x + bar_width for x in pos3]
pos5 = [x + bar_width for x in pos4]
pos6 = [x + bar_width for x in pos5]

b1 = ax.bar(pos1, eth_create, width=bar_width, label='ETH Create', color=c1, log=True)
for b in b1:
        ax.text(b.get_x() + b.get_width()/2., 1+b.get_height(), f"${b.get_height():.2f}", ha='center', va='bottom', fontdict={"size": 10}, rotation=90)
#for x, y in zip(pos1, eth_sign):
    #ax.text(x + 0.1, y + 1, f"${y:.2f}", fontdict={"size": 10})
    #tp = TextPath((x + 0.1,y + 1), f"${y:.2f}", size=0.4)
    #ax.add_patch(PathPatch(tp, color="black"))

b2 = ax.bar(pos2, eth_sign, width=bar_width, label='ETH Sign', color=c4)
for b in b2:
        rotation = 0 if b.get_height() > 100 else 90
        ax.text(b.get_x() + b.get_width()/2., b.get_height(), f" ${b.get_height():.2f}", ha='center', va='bottom', fontdict={"size": 10}, rotation=rotation)

b3 = ax.bar(pos3, eth_approve, width=bar_width, label='ETH Approve', color=c8)
for b in b3:
        ax.text(b.get_x() + b.get_width()/2., b.get_height(), f" ${b.get_height():.2f}", ha='center', va='bottom', fontdict={"size": 10}, rotation=90)

b4 = ax.bar(pos4, op_create, width=bar_width, label='OP Create', color=c1, edgecolor="white", hatch="/")
for b in b4:
        ax.text(b.get_x() + b.get_width()/2., b.get_height(), f" ${b.get_height():.2f}", ha='center', va='bottom', fontdict={"size": 10}, rotation=90)


b5 = ax.bar(pos5, op_sign, width=bar_width, label='OP Sign', color=c4, edgecolor="white", hatch="/")
for b in b5:
        ax.text(b.get_x() + b.get_width()/2., b.get_height(), f" ${b.get_height():.2f}", ha='center', va='bottom', fontdict={"size": 10}, rotation=90)

b6 = ax.bar(pos6, op_approve, width=bar_width, label='OP Approve', color=c8, edgecolor="white", hatch="/")
for b in b6:
        ax.text(b.get_x() + b.get_width()/2., b.get_height(), f" ${b.get_height():.2f}", ha='center', va='bottom', fontdict={"size": 10}, rotation=90)

#plt.yscale('log')

ax.set_ylabel("Estimated price in USD (log)")
ax.set_xticks([r + bar_width + (1.5 * bar_width) for r in range(len(create))], ["Eth. Addr.", "MT Membership", "Semaphore", "Pseudonym. Sig.\nsecp256k1", "Pseudonym. Sig.\nalt_bn128"])

#plt.ylabel("Estimated price in USD (log)")
#plt.xticks([r + bar_width for r in range(len(create))], ["Eth. Addr.", "ZoKrates", "Semaphore", "PSS\nsecp256k1", "PSS\nBn128"])

#ax.set_yticks(np.arange(0, 100, 1))
#ax.yaxis.set_major_formatter(matplotlib.ticker.ScalarFormatter())


ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda y,pos: ('{{:.{:1d}f}}'.format(int(np.maximum(-np.log10(y),0)))).format(y)))

#ax.minorticks_off()
#ax.figure.set_layout_engine('tight')
#plt.figure(constrained_layout=True)

fig.tight_layout()

plt.legend()
plt.show()
