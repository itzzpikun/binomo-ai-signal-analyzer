import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
};

export default Layout;
