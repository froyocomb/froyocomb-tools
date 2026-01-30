#!/bin/bash
# Easy to fool over, also might not work in earlier implementations, unless it is standarized
VERSION_ID=`cat /etc/os-release | grep "VERSION_ID" | sed 's/VERSION_ID=//g' | sed 's/["]//g'`
CODENAME=`cat /etc/lsb-release | grep "DISTRIB_CODENAME" | sed 's/DISTRIB_CODENAME=//g' | sed 's/["]//g'` 

check_root_user(){
    if [ "$(id -u)" != 0 ]; then
        echo 'You must use sudo to run the script.'
        exit
    fi
} 

check_version(){
if [ $VERSION_ID == 12.04 ] || [ $VERSION_ID == 12.04 ]; then
    echo "You must run Ubuntu 12.04 or 14.04 to use the script."
	exit
fi
}

menu(){
check_version
check_root_user
# clear
echo "Froyocomb Environment Setup" 
echo "Version 0.5" 
echo "Running on Ubuntu $VERSION_ID"
 echo "1 - Install dependencies"
 echo "2 - Obtain JDK"
 echo "3 - Update to newer Git"
 echo "4 - Compile Python"
 echo "5 - Setup repo script"
 read -p "option: " option
 case "$option" in
 "1") 
 restore_repositories
 update_system
 install_dependencies
 menu ;;
 "2") 
 select_jdk
 menu ;;
 "3") 
 install_new_git
 update_system 
 menu ;;
 "4") 
 compile_py
 menu;;
 "5") 
 setup_repo 
 menu ;;
 esac
}

restore_repositories(){
# This is only for Ubuntu 12.04.
  if [ $VERSION_ID == 12.04 ]
    then
     sed -Ei 's|[a-z]{2}\.archive\.ubuntu\.com|old-releases.ubuntu.com|g; s|security\.ubuntu\.com|old-releases.ubuntu.com|g' /etc/apt/sources.list
    fi
}

update_system(){
  apt-get update && apt-get upgrade -y 
}

install_dependencies(){
  apt-get -y install git gnupg flex bison gperf build-essential zip curl python-markdown xsltproc
  if [ $VERSION_ID == 12.04 ]
    then
    apt-get -y install libc6-dev libncurses5-dev:i386 x11proto-core-dev libx11-dev:i386 libreadline6-dev:i386 libgl1-mesa-dev gcc-multilib gcc-4.4 g++-4.4 gcc-4.4-multilib g++-4.4-multilib g++-multilib mingw32 tofrodos libxml2-utils zlib1g-dev:i386
    ln -s /usr/lib/i386-linux-gnu/mesa/libGL.so.1 /usr/lib/i386-linux-gnu/libGL.so
  fi
  if [ $VERSION_ID == 14.04 ]
    then
  apt-get -y install zlib1g-dev gcc-multilib g++-multilib libc6-dev-i386 lib32ncurses5-dev x11proto-core-dev libx11-dev lib32z-dev ccache libgl1-mesa-dev libxml2-utils unzip
  fi
}

install_new_git(){
echo -e "deb http://ppa.launchpad.net/git-core/ppa/ubuntu $CODENAME main\ndeb-src http://ppa.launchpad.net/git-core/ppa/ubuntu $CODENAME main" | tee /etc/apt/sources.list.d/git-core.list > /dev/null
apt-key adv --keyserver keyserver.ubuntu.com --recv-keys E363C90F8F1B6217
git config --global user.email "build@froyocomb.org"
git config --global user.name "Froyocomb Build"
}

compile_py(){
  if [ $VERSION_ID == 12.04 ]
    then
  apt-get build-dep python3.2 -y
  fi
  if [ $VERSION_ID == 14.04 ]
    then
  apt-get build-dep python3.4 -y
  fi
  wget https://www.python.org/ftp/python/3.6.15/Python-3.6.15.tgz -O /tmp/Python-3.6.15.tgz
  tar -xf /tmp/Python-3.6.15.tgz -C /tmp/
  cd /tmp/Python-3.6.15
  ./configure
  make -j$(nproc) && make install
}

setup_repo(){
  mkdir -p ~/.bin
  curl https://raw.githubusercontent.com/GerritCodeReview/git-repo/refs/tags/v2.60.1/repo > ~/.bin/repo
  chmod +x ~/.bin/repo
  echo 'export PATH="${HOME}/.bin:${PATH}"' >> ~/.bashrc
  export PATH="${HOME}/.bin:${PATH}"
}

select_jdk(){
echo "Select which Java version you want to use."
echo "1 - JDK 5"
echo "2 - JDK 6"
echo "3 - JDK 7"
echo "4 - JDK 8"
 read -p "option: " jdk_option
 case "$jdk_option" in 
 "1") 
 export JDK_VERSION=jdk1.5.0_22 
 detect_jdk ;;
 "2") 
 export JDK_VERSION=jdk1.6.0_45 
 detect_jdk ;;
 "3")
 export JDK_VERSION=java-7-openjdk-amd64 
 detect_jdk ;;
 "4")
 export JDK_VERSION=java-8-openjdk-amd64
 detect_jdk ;;
 esac
}

detect_jdk(){
if [ -d /usr/lib/jvm/$JDK_VERSION ]
 then
   set_default_jdk
 else
   install_jdk
   install_jdk_associations
   set_default_jdk
fi
}

set_default_jdk(){ 
   for i in /usr/lib/jvm/$JDK_VERSION/bin/*; do
        name=$(basename "$i")
	update-alternatives --set "$name" "$i"
   done
}

install_jdk_associations(){ 
   for i in /usr/lib/jvm/$JDK_VERSION/bin/*; do
        name=$(basename "$i")
         update-alternatives --install "/usr/bin/$name" "$name" "$i" 1
   done
}

install_jdk(){
   if [ $JDK_VERSION = jdk1.5.0_22 ]
    then 
	 wget https://archive.org/download/jdk-1_5_0_22-linux-i586/jdk-1_5_0_22-linux-amd64.bin -O /tmp/jdk1.5.0_22.bin
   fi
   if [ $JDK_VERSION = jdk1.6.0_45 ]
    then 
	 wget https://repo.huaweicloud.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.bin -O /tmp/jdk1.6.0_45.bin
   fi
   if [ $JDK_VERSION = java-7-openjdk-amd64 ]
    then
     apt-get install -y openjdk-7-jdk
   fi
   if [ $JDK_VERSION = java-8-openjdk-amd64 ]
    then
  apt-get install -y ca-certificates-java java-common libatk-wrapper-java-jni libatk-wrapper-java libgif4
     wget https://old-releases.ubuntu.com/ubuntu/pool/universe/o/openjdk-8/openjdk-8-jre-headless_8u45-b14-1_amd64.deb -O /tmp/openjdk-8-jre-headless_8u45-b14-1_amd64.deb
     wget https://old-releases.ubuntu.com/ubuntu/pool/universe/o/openjdk-8/openjdk-8-jre_8u45-b14-1_amd64.deb -O /tmp/openjdk-8-jre_8u45-b14-1_amd64.deb
     wget https://old-releases.ubuntu.com/ubuntu/pool/universe/o/openjdk-8/openjdk-8-jdk_8u45-b14-1_amd64.deb -O /tmp/openjdk-8-jdk_8u45-b14-1_amd64.deb
     dpkg -i /tmp/openjdk-8-jre-headless_8u45-b14-1_amd64.deb && dpkg -i /tmp/openjdk-8-jre_8u45-b14-1_amd64.deb && dpkg -i /tmp/openjdk-8-jdk_8u45-b14-1_amd64.deb
   fi
 
if [ $JDK_VERSION = jdk1.5.0_22 ] || [ $JDK_VERSION = jdk1.6.0_45 ];
 then
   chmod a+x /tmp/*.bin
   cd /tmp
   /tmp/$JDK_VERSION.bin
   mv -f /tmp/$JDK_VERSION /usr/lib/jvm/
 fi
   }
menu
