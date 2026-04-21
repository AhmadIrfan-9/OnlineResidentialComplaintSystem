import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      studentProfile: {
        include: {
          complaints: true
        }
      },
      wardenHostels: {
        include: {
          complaints: true
        }
      }
    }
  });

  const allComplaints = await prisma.complaint.findMany();
  
  let report = "# System Analytics & Performance Report\n\n";
  
  // System-wide metrics
  report += "## System-Wide Overview\n\n";
  report += `- **Total Users:** ${users.length}\n`;
  report += `- **Total Complaints:** ${allComplaints.length}\n`;
  
  const resolved = allComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status));
  report += `- **Resolved Complaints:** ${resolved.length}\n`;
  
  const pending = allComplaints.filter(c => !['RESOLVED', 'CLOSED'].includes(c.status));
  report += `- **Pending Complaints:** ${pending.length}\n\n`;

  let totalResTime = 0;
  let resCount = 0;
  resolved.forEach(c => {
    if (c.resolvedAt) {
      totalResTime += (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime());
      resCount++;
    } else if (c.closedAt) {
      totalResTime += (new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime());
      resCount++;
    }
  });
  
  const avgResTime = resCount > 0 ? (totalResTime / resCount / (1000 * 60 * 60)).toFixed(2) : "N/A";
  report += `- **Average Resolution Time:** ${avgResTime} Hours\n\n`;

  report += "## User Performance Metrics\n\n";
  report += "| User Name | Email | Role | Total Complaints | Resolved | Pending | Avg Resolution Time (Hrs) |\n";
  report += "|---|---|---|---|---|---|---|\n";

  for (const user of users) {
    let userComplaints: any[] = [];
    if (user.role === 'STUDENT' && user.studentProfile) {
      userComplaints = user.studentProfile.complaints;
    } else if (user.role === 'MANAGEMENT' && user.wardenHostels) {
      // Wardens manage complaints in their hostels
      user.wardenHostels.forEach(h => {
        userComplaints = userComplaints.concat(h.complaints);
      });
    }

    const total = userComplaints.length;
    let resolvedCount = 0;
    let pendingCount = 0;
    let userTotalResTime = 0;
    let userResCount = 0;

    userComplaints.forEach(c => {
      if (['RESOLVED', 'CLOSED'].includes(c.status)) {
        resolvedCount++;
        if (c.resolvedAt) {
          userTotalResTime += (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime());
          userResCount++;
        } else if (c.closedAt) {
          userTotalResTime += (new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime());
          userResCount++;
        }
      } else {
        pendingCount++;
      }
    });

    let avgTime = 'N/A';
    if (userResCount > 0) {
      avgTime = (userTotalResTime / userResCount / (1000 * 60 * 60)).toFixed(2);
    }
    
    // Fallback if no complaints but still want to show them
    report += `| ${user.name} | ${user.email} | ${user.role} | ${total} | ${resolvedCount} | ${pendingCount} | ${avgTime} |\n`;
  }

  console.log(report);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
